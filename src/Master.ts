import { logger } from './logger';
import { sharedInstalledDeviceManager } from './install';
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

interface WorkerInstance {
  name: string;
  installIds: string[];
  updatedMillisecond: number;
}

interface AppStartOptionInternal extends AppStartOption {
  express: express.Express;
  webhookUrl: string;
  port: number;
}

export class Master<T extends Database> {
  public adaptor: Adaptor;

  private readonly _appToken: string;
  private readonly _obnizSdkOption: SdkOption;
  private _startOptions?: AppStartOptionInternal;
  private _syncing = false;
  private _syncTimeout: any;
  private _allInstalls: { [key: string]: ManagedInstall } = {};
  private _allWorkerInstances: { [key: string]: WorkerInstance } = {};

  constructor(
    appToken: string,
    instanceName: string,
    database: T,
    databaseConfig: DatabaseConfig[T],
    obnizSdkOption: SdkOption
  ) {
    this._appToken = appToken;
    this._obnizSdkOption = obnizSdkOption;

    this.adaptor = new AdaptorFactory().create<T>(
      database,
      instanceName,
      true,
      databaseConfig
    );

    this.adaptor.onReported = async (
      reportInstanceName: string,
      installIds: string[]
    ) => {
      const exist = this._allWorkerInstances[reportInstanceName];
      if (exist) {
        exist.installIds = installIds;
        exist.updatedMillisecond = Date.now();
      } else {
        this._allWorkerInstances[reportInstanceName] = {
          name: reportInstanceName,
          installIds,
          updatedMillisecond: Date.now(),
        };
        this.onInstanceAttached(reportInstanceName);
      }
      this.onInstanceReported(reportInstanceName);
    };
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

  private async _webhook(_: express.Request, res: express.Response) {
    // TODO : check Instance and start
    try {
      await this._syncInstalls();
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
  private bestWorkerInstance(): WorkerInstance {
    const installCounts: any = {};
    for (const name in this._allWorkerInstances) {
      installCounts[name] = 0;
    }
    for (const id in this._allInstalls) {
      const managedInstall = this._allInstalls[id];
      installCounts[managedInstall.instanceName] += 1;
    }
    let minNumber = 1000 * 1000;
    let minInstance: WorkerInstance | null = null;
    for (const key in installCounts) {
      if (installCounts[key] < minNumber) {
        minInstance = this._allWorkerInstances[key];
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
  private onInstanceMissed(instanceName: string) {
    logger.info(`worker lost ${instanceName}`);
    // delete immediately
    const diedWorker: WorkerInstance = this._allWorkerInstances[instanceName];
    delete this._allWorkerInstances[instanceName];

    // Replacing missed instance workers.
    for (const id in this._allInstalls) {
      const managedInstall = this._allInstalls[id];
      if (managedInstall.instanceName === diedWorker.name) {
        const nextWorker = this.bestWorkerInstance();
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
  private onInstanceReported(instanceName: string) {
    const worker: WorkerInstance = this._allWorkerInstances[instanceName];
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
        this._healthCheck();
      } catch (e) {
        logger.error(e);
      }
    }, 10 * 1000);
  }

  private async _syncInstalls() {
    let success = false;
    try {
      if (this._syncing || !this.adaptor.isReady) {
        return success;
      }
      this._syncing = true;

      const startedTime = Date.now();
      logger.debug('API Sync Start');

      const installsApi = [];
      try {
        installsApi.push(
          ...(await sharedInstalledDeviceManager.getListFromObnizCloud(
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
        logger.debug(`all \t| added \t| updated \t| deleted`);
        logger.debug(
          `${installsApi.length} \t| ${mustAdds.length} \t| ${updated.length} \t| ${deleted.length}`
        );
      }

      for (const install of updated) {
        const managedInstall = this._allInstalls[install.id];
        managedInstall.install = install;
      }
      for (const managedInstall of deleted) {
        managedInstall.status = InstallStatus.Stopping;
        delete this._allInstalls[managedInstall.install.id];
      }
      for (const install of mustAdds) {
        const instance = this.bestWorkerInstance(); // maybe throw
        const managedInstall: ManagedInstall = {
          instanceName: instance.name,
          status: InstallStatus.Starting,
          updatedMillisecond: Date.now(),
          install,
        };
        this._allInstalls[install.id] = managedInstall;
      }
      await this.synchronize();
      success = true;
    } catch (e) {
      console.error(e);
    }
    this._syncing = false;
    return success;
  }

  private async synchronize() {
    const separated: { [key: string]: InstalledDevice[] } = {};
    for (const id in this._allInstalls) {
      const managedInstall: ManagedInstall = this._allInstalls[id];
      const instanceName = managedInstall.instanceName;
      if (!separated[instanceName]) {
        separated[instanceName] = [];
      }
      separated[instanceName].push(managedInstall.install);
    }
    //
    for (const instanceName in separated) {
      logger.debug(
        `synchronize sent to ${instanceName} idsCount=${separated[instanceName].length}`
      );
      await this.adaptor.synchronize(instanceName, separated[instanceName]);
    }
  }

  private _healthCheck() {
    const current = Date.now();
    // each install
    // for (const id in this._allInstalls) {
    //   const managedInstall = this._allInstalls[id];
    //   if (managedInstall.updatedMillisecond + 60 * 1000 < current) {
    //     // over time.
    //     this._onHealthCheckFailedInstall(managedInstall);
    //   }
    // }
    // each room
    for (const id in this._allWorkerInstances) {
      const workerInstance = this._allWorkerInstances[id];
      if (workerInstance.updatedMillisecond + 30 * 1000 < current) {
        // over time.
        this._onHealthCheckFailedWorkerInstance(workerInstance);
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

  public hasSubClusteredInstances(): boolean {
    return Object.keys(this._allWorkerInstances).length > 1;
  }
}
