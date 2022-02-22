import { logger } from './logger';
import { obnizCloudClientInstance, AppEvent } from './obnizCloudClient';
import { Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';
import { Adaptor } from './adaptor/Adaptor';
import express from 'express';
import { AppStartOption } from './App';
import {
  AdaptorFactory,
  Database,
  DatabaseConfig,
} from './adaptor/AdaptorFactory';
import { SdkOption } from 'obniz-cloud-sdk';
import { wait } from './tools';
import {
  ObnizAppMasterSlaveCommunicationError,
  ObnizAppTimeoutError,
} from './Errors';
import { MemoryWorkerStore } from './worker_store/MemoryWorkerStore';
import {
  WorkerInstance,
  WorkerStoreBase,
} from './worker_store/WorkerStoreBase';
import { RedisAdaptor } from './adaptor/RedisAdaptor';
import { RedisWorkerStore } from './worker_store/RedisWorkerStore';

enum InstallStatus {
  Starting,
  Started,
  Stopping,
  Stopped,
}

interface ManagedInstall {
  instanceName: string; // Which Instance handling this
  install: InstalledDevice;
  status: InstallStatus;
  updatedMillisecond: number;
}

interface AppStartOptionInternal extends AppStartOption {
  express: express.Express;
  webhookUrl: string;
  port: number;
}

interface KeyRequestExecute {
  requestId: string;
  returnedInstanceCount: number;
  waitingInstanceCount: number;
  results: { [key: string]: string };
  reject: (reason?: any) => void;
  resolve: (
    value: { [key: string]: string } | PromiseLike<{ [key: string]: string }>
  ) => void;
}

export class Manager<T extends Database> {
  public adaptor: Adaptor;

  private readonly _appToken: string;
  private readonly _obnizSdkOption: SdkOption;
  private _startOptions?: AppStartOptionInternal;
  private _instanceName: string;
  private _syncing = false;
  private _syncTimeout: any;
  private _workerStore: WorkerStoreBase;
  private _allInstalls: { [key: string]: ManagedInstall } = {};

  // Note: moved to _workerStore
  // private _allWorkerInstances: { [key: string]: WorkerInstance } = {};

  private _keyRequestExecutes: { [key: string]: KeyRequestExecute } = {};

  private _currentAppEventsSequenceNo = 0;

  constructor(
    appToken: string,
    instanceName: string,
    database: T,
    databaseConfig: DatabaseConfig[T],
    obnizSdkOption: SdkOption
  ) {
    this._appToken = appToken;
    this._obnizSdkOption = obnizSdkOption;
    this._instanceName = instanceName;

    this.adaptor = new AdaptorFactory().create<T>(
      database,
      instanceName,
      true,
      databaseConfig
    );

    /**
     * Workerのうちいずれかから状況報告をもらった
     * これが初回連絡の場合、onInstanceAttached()が呼ばれる
     */
    this.adaptor.onReported = async (
      reportInstanceName: string,
      installIds: string[]
    ) => {
      const exist = await this._workerStore.getWorkerInstance(
        reportInstanceName
      );
      if (exist) {
        await this._workerStore.updateWorkerInstance(reportInstanceName, {
          installIds,
          updatedMillisecond: Date.now(),
        });
      } else {
        this._workerStore.addWorkerInstance(reportInstanceName, {
          installIds,
          updatedMillisecond: Date.now(),
        });
        this.onInstanceAttached(reportInstanceName);
      }
      await this.onInstanceReported(reportInstanceName);
    };

    this.adaptor.onKeyRequestResponse = async (
      requestId: string,
      fromInstanceName: string,
      results: { [key: string]: string }
    ) => {
      if (this._keyRequestExecutes[requestId]) {
        this._keyRequestExecutes[requestId].results = {
          ...this._keyRequestExecutes[requestId].results,
          ...results,
        };
        this._keyRequestExecutes[requestId].returnedInstanceCount++;
        if (
          this._keyRequestExecutes[requestId].returnedInstanceCount ===
          this._keyRequestExecutes[requestId].waitingInstanceCount
        ) {
          this._keyRequestExecutes[requestId].resolve(
            this._keyRequestExecutes[requestId].results
          );
          delete this._keyRequestExecutes[requestId];
        }
      }
    };

    if (this.adaptor instanceof RedisAdaptor) {
      this._workerStore = new RedisWorkerStore(this.adaptor);
    } else {
      this._workerStore = new MemoryWorkerStore();
    }
  }

  public start(option?: AppStartOption): void {
    this._startWeb(option);
    this._startSyncing();
    this._startHealthCheck();
  }

  private _startWeb(option?: AppStartOption): void {
    option = option || {};
    if (option.express === false) {
      // nothing
      return;
    }
    this._startOptions = {
      express: option.express || express(),
      webhookUrl: option.webhookUrl || '/webhook',
      port: option.port || 3333,
    };
    this._startOptions.express.get(this._startOptions.webhookUrl, this.webhook);
    this._startOptions.express.post(
      this._startOptions.webhookUrl,
      this.webhook
    );

    if (!option.express) {
      this._startOptions.express.listen(this._startOptions.port, () => {
        logger.debug(
          `App listening on http://localhost:${
            (this._startOptions || {}).port
          } `
        );
      });
    }
  }

  webhook = this._webhook.bind(this);

  private async _webhook(req: express.Request, res: express.Response) {
    // TODO : check Instance and start
    try {
      await this._syncInstalls(true);
    } catch (e) {
      logger.error(e);
      res.status(500).json({});
      return;
    }
    res.json({});
  }

  /**
   * 空き状況から最適なWorkerを推測
   */
  private async bestWorkerInstance(): Promise<WorkerInstance> {
    const installCounts: any = {};
    const instances = await this._workerStore.getAllWorkerInstances();
    for (const name in instances) {
      installCounts[name] = 0;
    }
    for (const id in this._allInstalls) {
      const managedInstall = this._allInstalls[id];
      if (installCounts[managedInstall.instanceName] === undefined) continue;
      installCounts[managedInstall.instanceName] += 1;
    }
    let minNumber = 1000 * 1000;
    let minInstance: WorkerInstance | null = null;
    for (const key in installCounts) {
      if (installCounts[key] < minNumber) {
        minInstance = instances[key];
        minNumber = installCounts[key];
      }
    }
    if (!minInstance) {
      throw new Error(`No Valid Instance`);
    }
    return minInstance;
  }

  /**
   * instanceId がidのWorkerが新たに参加した
   * @param id
   */
  private onInstanceAttached(instanceName: string): void {
    // const worker: WorkerInstance = this._allWorkerInstances[instanceName];
    // TODO: Overloadのinstanceがあれば引っ越しさせる
    logger.info(`new worker recognized ${instanceName}`);
  }

  /**
   * instanceId がidのWorkerが喪失した
   * @param id
   */
  private async onInstanceMissed(instanceName: string) {
    logger.info(`worker lost ${instanceName}`);
    // delete immediately
    const diedWorker = await this._workerStore.getWorkerInstance(instanceName);
    if (!diedWorker) throw new Error('Failed get diedWorker status');
    await this._workerStore.deleteWorkerInstance(instanceName);

    // Replacing missed instance workers.
    for (const id in this._allInstalls) {
      const managedInstall = this._allInstalls[id];
      if (managedInstall.instanceName === diedWorker.name) {
        const nextWorker = await this.bestWorkerInstance();
        managedInstall.instanceName = nextWorker.name;
        managedInstall.status = InstallStatus.Starting;
      }
    }

    // synchronize
    this.synchronize()
      .then()
      .catch((e) => {
        logger.error(e);
      });
  }

  /**
   * instanceId がidのWorkerから新しい情報が届いた（定期的に届く）
   * @param id
   */
  private async onInstanceReported(instanceName: string) {
    const worker = await this._workerStore.getWorkerInstance(instanceName);
    if (worker) {
      for (const existId of worker.installIds) {
        const managedInstall: ManagedInstall = this._allInstalls[existId];
        if (managedInstall) {
          managedInstall.status = InstallStatus.Started;
          managedInstall.updatedMillisecond = Date.now();
        } else {
          // ghost
          logger.debug(`Ignore ghost instance=${instanceName} id=${existId}`);
        }
      }
    }
  }

  private _startSyncing(timeout?: number) {
    // every minutes
    if (!this._syncTimeout) {
      this._syncTimeout = setTimeout(async () => {
        this._syncTimeout = undefined;
        let success = false;
        try {
          success = await this._syncInstalls();
        } catch (e) {
          logger.error(e);
        } finally {
          this._startSyncing(success ? 60 * 1000 : 3 * 1000);
        }
      }, timeout || 0);
    }
  }

  private _startHealthCheck() {
    setInterval(async () => {
      try {
        await this._healthCheck();
      } catch (e) {
        logger.error(e);
      }
    }, 10 * 1000);
  }

  private async _syncInstalls(diffOnly = false) {
    let success = false;
    try {
      if (this._syncing || !this.adaptor.isReady) {
        return success;
      }
      this._syncing = true;

      if (diffOnly) {
        await this._checkDiffInstalls();
      } else {
        await this._checkAllInstalls();
      }

      await this.synchronize();
      success = true;
    } catch (e) {
      console.error(e);
    }
    this._syncing = false;
    return success;
  }

  private async _checkAllInstalls() {
    const startedTime = Date.now();
    logger.debug('API Sync Start');
    const installsApi: InstalledDevice[] = [];
    try {
      // set current id before getting data
      this._currentAppEventsSequenceNo = await obnizCloudClientInstance.getCurrentEventNo(
        this._appToken,
        this._obnizSdkOption
      );

      installsApi.push(
        ...(await obnizCloudClientInstance.getListFromObnizCloud(
          this._appToken,
          this._obnizSdkOption
        ))
      );
    } catch (e) {
      console.error(e);
      process.exit(-1);
    }

    logger.debug(
      `API Sync Finished Count=${installsApi.length} duration=${
        Date.now() - startedTime
      }msec`
    );

    /**
     * Compare with currents
     */
    const mustAdds: InstalledDevice[] = [];
    const updated: InstalledDevice[] = [];
    const deleted: ManagedInstall[] = [];
    for (const install of installsApi) {
      let found = false;
      for (const id in this._allInstalls) {
        const oldInstall = this._allInstalls[id].install;
        if (install.id === id) {
          if (JSON.stringify(install) !== JSON.stringify(oldInstall)) {
            // updated
            updated.push(install);
          }
          found = true;
          break;
        }
      }
      if (!found) {
        mustAdds.push(install);
      }
    }
    for (const id in this._allInstalls) {
      let found = false;
      for (const install of installsApi) {
        if (id === install.id) {
          found = true;
          break;
        }
      }
      if (!found) {
        deleted.push(this._allInstalls[id]);
      }
    }

    if (mustAdds.length + updated.length + deleted.length > 0) {
      const allNum =
        Object.keys(this._allInstalls).length +
        mustAdds.length -
        deleted.length;
      logger.debug(`all \t| added \t| updated \t| deleted`);
      logger.debug(
        `${allNum} \t| ${mustAdds.length} \t| ${updated.length} \t| ${deleted.length}`
      );
    }

    const updatePromises: Promise<void>[] = [];
    for (const install of updated) {
      updatePromises.push(this._updateDevice(install.id, install));
    }
    await Promise.all(updatePromises);

    for (const managedInstall of deleted) {
      this._deleteDevice(managedInstall.install.id);
    }

    for await (const install of mustAdds) {
      await this._addDevice(install.id, install);
    }
  }

  private async _checkDiffInstalls() {
    const startedTime = Date.now();
    logger.debug('API Diff Sync Start');
    const events: AppEvent[] = [];
    try {
      const {
        maxId,
        appEvents,
      } = await obnizCloudClientInstance.getDiffListFromObnizCloud(
        this._appToken,
        this._obnizSdkOption,
        this._currentAppEventsSequenceNo
      );
      events.push(...appEvents);
      this._currentAppEventsSequenceNo = maxId;
    } catch (e) {
      console.error(e);
      process.exit(-1);
    }

    logger.debug(
      `API Diff Sync Finished DiffCount=${events.length} duration=${
        Date.now() - startedTime
      }msec`
    );

    if (events.length > 0) {
      const addNum = events.filter((e) => e.type === 'install.create').length;
      const updateNum = events.filter((e) => e.type === 'install.update')
        .length;
      const deleteNum = events.filter((e) => e.type === 'install.delete')
        .length;
      const allNum = Object.keys(this._allInstalls).length + addNum - deleteNum;
      logger.debug(`all \t| added \t| updated \t| deleted`);
      logger.debug(`${allNum} \t| ${addNum} \t| ${updateNum} \t| ${deleteNum}`);
    }

    const list: { [id: string]: AppEvent } = {};

    // overwrite newer if device duplicate
    for (const one of events) {
      if (one.payload.device) {
        list[one.payload.device.id] = one;
      }
    }

    for (const key in list) {
      const one = list[key];
      if (one.type === 'install.update' && one.payload.device) {
        this._updateDevice(
          one.payload.device.id,
          one.payload.device as InstalledDevice
        );
      } else if (one.type === 'install.delete' && one.payload.device) {
        this._deleteDevice(one.payload.device.id);
      } else if (one.type === 'install.create' && one.payload.device) {
        await this._addDevice(
          one.payload.device.id,
          one.payload.device as InstalledDevice
        );
      }
    }
  }

  private async _addDevice(obnizId: string, device: InstalledDevice) {
    if (this._allInstalls[obnizId]) {
      // already exist
      this._updateDevice(obnizId, device);
      return;
    }
    const instance = await this.bestWorkerInstance(); // maybe throw
    const managedInstall: ManagedInstall = {
      instanceName: instance.name,
      status: InstallStatus.Starting,
      updatedMillisecond: Date.now(),
      install: device,
    };
    this._allInstalls[obnizId] = managedInstall;
  }

  private async _updateDevice(obnizId: string, device: InstalledDevice) {
    const managedInstall = this._allInstalls[obnizId];
    if (!managedInstall) {
      await this._addDevice(obnizId, device);
      return;
    }
    managedInstall.install = device;
  }

  private _deleteDevice(obnizId: string) {
    if (!this._allInstalls[obnizId]) {
      // not exist
      return;
    }
    this._allInstalls[obnizId].status = InstallStatus.Stopping;
    delete this._allInstalls[obnizId];
  }

  private async synchronize() {
    const installsByInstanceName: { [key: string]: InstalledDevice[] } = {};
    for (const instanceName in await this._workerStore.getAllWorkerInstances()) {
      installsByInstanceName[instanceName] = [];
    }
    for (const id in this._allInstalls) {
      const managedInstall: ManagedInstall = this._allInstalls[id];
      const instanceName = managedInstall.instanceName;
      installsByInstanceName[instanceName].push(managedInstall.install);
    }
    for (const instanceName in installsByInstanceName) {
      logger.debug(
        `synchronize sent to ${instanceName} idsCount=${installsByInstanceName[instanceName].length}`
      );
      await this.adaptor.synchronize(
        instanceName,
        installsByInstanceName[instanceName]
      );
    }
  }

  private async _healthCheck() {
    const current = Date.now();
    // each install
    // for (const id in this._allInstalls) {
    //   const managedInstall = this._allInstalls[id];
    //   if (managedInstall.updatedMillisecond + 60 * 1000 < current) {
    //     // over time.
    //     this._onHealthCheckFailedInstall(managedInstall);
    //   }
    // }
    // Me
    if (this.adaptor instanceof RedisAdaptor) {
      // If adaptor is Redis
      const redis = this.adaptor.getRedisInstance();
      await redis.set(
        `master:${this._instanceName}:heartbeat`,
        Date.now(),
        'EX',
        20
      );
    }
    // Each room
    const instances = await this._workerStore.getAllWorkerInstances();
    for (const [id, instance] of Object.entries(instances)) {
      if (instance.updatedMillisecond + 30 * 1000 < current) {
        // over time.
        this._onHealthCheckFailedWorkerInstance(instance);
      }
    }
  }

  // private _onHealthCheckFailedInstall(managedInstall: ManagedInstall) {
  //   logger.warn(`health check failed install ${managedInstall.install.id}`)
  // }

  private _onHealthCheckFailedWorkerInstance(workerInstance: WorkerInstance) {
    logger.warn(`health check failed worker ${workerInstance.name}`);
    this.onInstanceMissed(workerInstance.name);
  }

  public async hasSubClusteredInstances(): Promise<boolean> {
    return (
      Object.keys(await this._workerStore.getAllWorkerInstances()).length > 1
    );
  }

  public async request(
    key: string,
    timeout: number
  ): Promise<{ [key: string]: string }> {
    const waitingInstanceCount = Object.keys(
      await this._workerStore.getAllWorkerInstances()
    ).length;
    return new Promise<{ [key: string]: string }>(async (resolve, reject) => {
      try {
        const requestId = `${Date.now()} - ${Math.random()
          .toString(36)
          .slice(-8)}`;
        const execute: KeyRequestExecute = {
          requestId,
          returnedInstanceCount: 0,
          waitingInstanceCount,
          results: {},
          resolve,
          reject,
        };
        await this.adaptor.keyRequest(key, requestId);
        this._keyRequestExecutes[requestId] = execute;
        await wait(timeout);
        if (this._keyRequestExecutes[requestId]) {
          delete this._keyRequestExecutes[requestId];
          reject(new ObnizAppTimeoutError('Request timed out.'));
        } else {
          reject(
            new ObnizAppMasterSlaveCommunicationError(
              'Could not get request data.'
            )
          );
        }
      } catch (e) {
        reject(e);
      }
    });
  }
}
