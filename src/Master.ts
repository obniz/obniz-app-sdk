import { logger } from './logger';
import { getInstallRequest } from './install';
import { Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';
import { Adaptor } from './adaptor/Adaptor';
import { RedisAdaptor } from './adaptor/RedisAdaptor';
import express from 'express';
import { AppStartOption, Database, DatabaseConfig } from './App';
import { MemoryAdaptor } from './adaptor/MemoryAdaptor';

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
  public scaleFactor: number;

  private readonly _appToken: string;
  private _startOptions?: AppStartOptionInternal;
  private _syncing = false;
  private _interval?: any;
  private _allInstalls: { [key: string]: ManagedInstall } = {};
  private _allWorkerInstances: { [key: string]: WorkerInstance } = {};

  constructor(
    appToken: string,
    instanceName: string,
    scaleFactor: number,
    database: T,
    databaseConfig: DatabaseConfig[T]
  ) {
    this._appToken = appToken;
    this.scaleFactor = scaleFactor;

    if (scaleFactor > 0) {
      if (database !== 'redis') {
        throw new Error('Supported database type is only redis now.');
      }
      this.adaptor = new RedisAdaptor(
        instanceName,
        true,
        databaseConfig as DatabaseConfig['redis']
      );
    } else if (database === 'memory') {
      this.adaptor = new MemoryAdaptor(
        instanceName,
        true,
        databaseConfig as DatabaseConfig['memory']
      );
    } else {
      throw new Error('Unsupported database type: ' + database);
    }
    this.adaptor.onReported = async (
      reportInstanceName: string,
      installIds: string[]
    ) => {
      // logger.debug(`receive report ${reportInstanceName}`)
      const exist = this._allWorkerInstances[reportInstanceName];
      if (exist) {
        exist.installIds = installIds;
        exist.updatedMillisecond = Date.now().valueOf();
      } else {
        this._allWorkerInstances[reportInstanceName] = {
          name: reportInstanceName,
          installIds,
          updatedMillisecond: Date.now().valueOf(),
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
  }

  /**
   * instanceId がidのWorkerが喪失した
   * @param id
   */
  private onInstanceMissed(instanceName: string) {
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
      const managedInstall = this._allInstalls[existId];
      if (managedInstall) {
        managedInstall.status = InstallStatus.Started;
        managedInstall.updatedMillisecond = Date.now().valueOf();
      } else {
        // ghost
        logger.debug(`Ignore ghost ${instanceName}`);
      }
    }
  }

  private _startSyncing() {
    // every minutes
    if (!this._interval) {
      this._interval = setInterval(async () => {
        try {
          await this._syncInstalls();
        } catch (e) {
          logger.error(e);
        }
      }, 60 * 1000);
      this._syncInstalls()
        .then()
        .catch((e) => {
          logger.error(e);
        });
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
    try {
      if (this._syncing) {
        return;
      }
      this._syncing = true;

      // logger.debug("sync api start");

      const installsApi = [];
      try {
        installsApi.push(...(await getInstallRequest(this._appToken)));
      } catch (e) {
        console.error(e);
        process.exit(-1);
      }

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
          updatedMillisecond: Date.now().valueOf(),
          install,
        };
        this._allInstalls[install.id] = managedInstall;
      }
      await this.synchronize();
    } catch (e) {
      console.error(e);
    }
    this._syncing = false;
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
    const current = Date.now().valueOf();
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
}
