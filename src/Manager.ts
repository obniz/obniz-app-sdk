import { logger } from './logger';
import { obnizCloudClientInstance, AppEvent } from './ObnizCloudClient';
import { Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';
import { Adaptor } from './adaptor/Adaptor';
import express from 'express';
import { AppStartOption } from './App';
import { SdkOption } from 'obniz-cloud-sdk';
import { wait } from './utils/common';
import {
  ObnizAppIdNotFoundError,
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
import {
  InstallStoreBase,
  ManagedInstall,
} from './install_store/InstallStoreBase';
import { RedisInstallStore } from './install_store/RedisInstallStore';
import { MemoryInstallStore } from './install_store/MemoryInstallStore';
import { deepEqual } from 'fast-equals';

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

export class Manager {
  public adaptor: Adaptor;

  private readonly _appToken: string;
  private readonly _obnizSdkOption: SdkOption;
  private _startOptions?: AppStartOptionInternal;
  private _instanceName: string;
  private _syncing = false;
  private _syncTimeout: any;
  private _workerStore: WorkerStoreBase;
  private _installStore: InstallStoreBase;

  // Note: moved to _installStore
  // private _allInstalls: { [key: string]: ManagedInstall } = {};

  // Note: moved to _workerStore
  // private _allWorkerInstances: { [key: string]: WorkerInstance } = {};

  private _keyRequestExecutes: { [key: string]: KeyRequestExecute } = {};

  private _currentAppEventsSequenceNo = 0;

  constructor(
    appToken: string,
    instanceName: string,
    adaptor: Adaptor,
    obnizSdkOption: SdkOption
  ) {
    this._appToken = appToken;
    this._obnizSdkOption = obnizSdkOption;
    this._instanceName = instanceName;
    this.adaptor = adaptor;

    /**
     * Workerのうちいずれかから状況報告をもらった
     * これが初回連絡の場合、onInstanceAttached()が呼ばれる
     */
    this.adaptor.onReported = async (
      reportInstanceName: string,
      installIds: string[]
    ) => {
      if (!(this._workerStore instanceof MemoryWorkerStore)) return;
      const exist = await this._workerStore.getWorkerInstance(
        reportInstanceName
      );
      if (exist) {
        this._workerStore.updateWorkerInstance(reportInstanceName, {
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
      this._installStore = new RedisInstallStore(this.adaptor);
    } else {
      const workerStore = new MemoryWorkerStore();
      this._workerStore = workerStore;
      this._installStore = new MemoryInstallStore(workerStore);
    }
  }

  public start(option?: AppStartOption): void {
    this._startWeb(option);
    this._startSyncing();
    this._startHealthCheck();
    setTimeout(async () => {
      await this._writeSelfHeartbeat();
    }, 0);
  }

  public async startWait(option?: AppStartOption): Promise<void> {
    this._startWeb(option);
    this._startSyncing();
    this._startHealthCheck();
    await this._writeSelfHeartbeat();
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

    // Replacing missed instance workers.
    const missedInstalls = await this._installStore.getByWorker(
      diedWorker.name
    );
    for await (const install of Object.keys(missedInstalls)) {
      try {
        const instance = await this._installStore.autoRelocate(install, false);
      } catch (e) {
        if (e instanceof Error) {
          switch (e.message) {
            case 'NO_NEED_TO_RELOCATE':
              logger.info(`${install} already moved available worker.`);
              break;
            default:
              logger.error(`Failed autoRelocate: ${e.message} (${e.name})`);
              break;
          }
        } else {
          logger.error(e);
        }
      }
    }

    await this._workerStore.deleteWorkerInstance(instanceName);

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
        const managedInstall = await this._installStore.get(existId);
        if (managedInstall) {
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
        await this._writeSelfHeartbeat();
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
      this._currentAppEventsSequenceNo =
        await obnizCloudClientInstance.getCurrentEventNo(
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
      logger.error(`API Sync failed duration=${Date.now() - startedTime}msec`);
      console.error(e);
      return;
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
    const ids = installsApi.map((d) => d.id);
    const devices = await this._installStore.getMany(ids);
    for (const device of installsApi) {
      const install = devices[device.id];
      if (!install) {
        mustAdds.push(device);
      } else {
        if (!deepEqual(device, install.install)) updated.push(device);
      }
    }
    const installs = await this._installStore.getAll();
    for (const id in installs) {
      let found = false;
      for (const install of installsApi) {
        if (id === install.id) {
          found = true;
          break;
        }
      }
      if (!found) {
        deleted.push(installs[id]);
      }
    }

    if (mustAdds.length + updated.length + deleted.length > 0) {
      const allNum =
        Object.keys(installs).length + mustAdds.length - deleted.length;
      logger.debug(`all \t| added \t| updated \t| deleted`);
      logger.debug(
        `${allNum} \t| ${mustAdds.length} \t| ${updated.length} \t| ${deleted.length}`
      );
    }

    for await (const updDevice of updated) {
      await this._updateDevice(updDevice.id, updDevice);
    }

    for await (const delInstall of deleted) {
      await this._deleteDevice(delInstall.install.id);
    }

    for await (const addDevice of mustAdds) {
      await this._addDevice(addDevice.id, addDevice);
    }
  }

  private async _checkDiffInstalls() {
    const startedTime = Date.now();
    logger.debug('API Diff Sync Start');
    const events: AppEvent[] = [];
    try {
      const { maxId, appEvents } =
        await obnizCloudClientInstance.getDiffListFromObnizCloud(
          this._appToken,
          this._obnizSdkOption,
          this._currentAppEventsSequenceNo
        );
      events.push(...appEvents);
      this._currentAppEventsSequenceNo = maxId;
    } catch (e) {
      logger.error(`API Sync failed duration=${Date.now() - startedTime}msec`);
      console.error(e);
      return;
    }

    logger.debug(
      `API Diff Sync Finished DiffCount=${events.length} duration=${
        Date.now() - startedTime
      }msec`
    );

    if (events.length > 0) {
      const addNum = events.filter((e) => e.type === 'install.create').length;
      const updateNum = events.filter(
        (e) => e.type === 'install.update'
      ).length;
      const deleteNum = events.filter(
        (e) => e.type === 'install.delete'
      ).length;
      const allNum =
        Object.keys(await this._installStore.getAll()).length +
        addNum -
        deleteNum;
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

    for await (const key of Object.keys(list)) {
      const one = list[key];
      if (one.type === 'install.update' && one.payload.device) {
        this._updateDevice(
          one.payload.device.id,
          one.payload.device as InstalledDevice
        );
      } else if (one.type === 'install.delete' && one.payload.device) {
        await this._deleteDevice(one.payload.device.id);
      } else if (one.type === 'install.create' && one.payload.device) {
        await this._addDevice(
          one.payload.device.id,
          one.payload.device as InstalledDevice
        );
      }
    }
  }

  private async _addDevice(obnizId: string, device: InstalledDevice) {
    try {
      const createdInstall = await this._installStore.autoCreate(
        obnizId,
        device
      );
      return createdInstall;
    } catch (e) {
      if (e instanceof Error) {
        switch (e.message) {
          case 'ALREADY_INSTALLED':
            logger.info(`${obnizId} already created.`);
            break;
          default:
            logger.error(`Failed autoCreate: ${e.message} (${e.name})`);
            break;
        }
      } else {
        logger.error(e);
      }
    }
  }

  private async _updateDevice(obnizId: string, device: InstalledDevice) {
    const install = await this._installStore.get(obnizId);
    if (!install) {
      return await this._addDevice(obnizId, device);
    }
    const updatedInstall = await this._installStore.update(obnizId, {
      install: device,
    });
    return updatedInstall;
  }

  private async _deleteDevice(obnizId: string) {
    await this._installStore.remove(obnizId);
  }

  private async synchronize() {
    const installsByInstanceName: { [key: string]: InstalledDevice[] } = {};
    const instances = await this._workerStore.getAllWorkerInstances();
    const instanceKeys = Object.keys(instances);
    if (this.adaptor instanceof RedisAdaptor) {
      logger.debug(`Sent sync request via Redis to all instance.`);
      await this.adaptor.synchronizeRequest({
        syncType: 'redis',
      });
    } else {
      for (const instanceName in instances) {
        installsByInstanceName[instanceName] = [];
      }
      const installs = await this._installStore.getAll();
      for (const id in installs) {
        const managedInstall: ManagedInstall = installs[id];
        const instanceName = managedInstall.instanceName;
        installsByInstanceName[instanceName].push(managedInstall.install);
      }
      for await (const instanceName of instanceKeys) {
        logger.debug(
          `synchronize sent to ${instanceName} idsCount=${installsByInstanceName[instanceName].length}`
        );
        await this.adaptor.synchronizeRequest({
          syncType: 'list',
          installs: installsByInstanceName[instanceName],
        });
      }
    }
  }

  private async _writeSelfHeartbeat() {
    if (!(this.adaptor instanceof RedisAdaptor)) return;
    await this.adaptor.onManagerHeartbeat();
  }

  private async _healthCheck() {
    const current = Date.now();
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
        this._keyRequestExecutes[requestId] = execute;
        await this.adaptor.keyRequest(key, requestId);
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

  public async directRequest(
    obnizId: string,
    key: string,
    timeout: number
  ): Promise<{ [key: string]: string }> {
    const install = await this._installStore.get(obnizId);
    if (!install)
      throw new ObnizAppIdNotFoundError(`${obnizId}'s Worker is not running`);
    return new Promise<{ [key: string]: string }>(async (resolve, reject) => {
      try {
        const requestId = `${Date.now()} - ${Math.random()
          .toString(36)
          .slice(-8)}`;
        const execute: KeyRequestExecute = {
          requestId,
          returnedInstanceCount: 0,
          waitingInstanceCount: 1,
          results: {},
          resolve,
          reject,
        };
        this._keyRequestExecutes[requestId] = execute;
        await this.adaptor.directKeyRequest(
          obnizId,
          install.instanceName,
          key,
          requestId
        );
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

  public isFirstMaster(): boolean {
    if (!(this.adaptor instanceof RedisAdaptor)) return true;
    const status = this.adaptor.getManagerStatus();
    if (!status.initialized)
      throw new Error(
        'init process has not been completed. Please delay a little longer before checking or start app using startWait().'
      );
    return status.isFirstManager;
  }

  public async doAllRelocate(): Promise<void> {
    if (!(this._installStore instanceof RedisInstallStore))
      throw new Error(
        'This function is currently only available when using redis.'
      );
    await this._installStore.doAllRelocate();
    await this.synchronize();
  }
}
