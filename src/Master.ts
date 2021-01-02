import {logger} from './logger'
import {getInstallRequest} from "./install";
import { Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';
import {Adaptor} from './adaptor/Adaptor';
import {RedisAdaptor} from './adaptor/RedisAdaptor';
import express from 'express';
import {AppStartOption} from './App'

enum InstallStatus {
  Starting,
  Started,
  Stopping,
  Stopped
}

interface ManagedInstall {
  instanceName: string; // Which Instance handling this 
  install: InstalledDevice;
  status: InstallStatus;
  updatedMillisecond: number;
}

interface WorkerInstance {
  name: string
  installIds: string[],
  updatedMillisecond: number;
}

interface AppStartOptionInternal extends AppStartOption {
  express: express.Express;
  webhookUrl: string;
  port: number;
}

export class Master {
  public adaptor: Adaptor;
  public scaleFactor: number;

  private _appToken:string;
  private _startOptions?: AppStartOptionInternal;
  private _syncing: boolean = false;
  private _interval?: any;
  private _allInstalls: { [key: string]: ManagedInstall } = {};
  private _allWorkerInstances: { [key: string]: WorkerInstance } = {};
  
  constructor(appToken:string, instanceName: string, scaleFactor: number){
    this._appToken = appToken;
    this.scaleFactor = scaleFactor;
    if(scaleFactor > 0) {
      this.adaptor = new RedisAdaptor(instanceName, true);
    } else {
      this.adaptor = new Adaptor();
    }
    this.adaptor.onReported = async (instanceName: string, installIds: string[]) => {
      // logger.debug(`receive report ${instanceName}`)
      const exist = this._allWorkerInstances[instanceName];
      if (exist) {
        exist.installIds = installIds;
        exist.updatedMillisecond = Date.now().valueOf();
      } else {
        this._allWorkerInstances[instanceName] = {
          name: instanceName,
          installIds: installIds,
          updatedMillisecond: Date.now().valueOf()
        }
        this.onInstanceAttached(instanceName);
      }
      this.onInstanceReported(instanceName);
    }
  }

  public start(option?: AppStartOption) {
    this._startWeb(option);
    this._startSyncing();
    this._startHealthCheck();
  }

  private _startWeb(option?: AppStartOption) {
    option = option || {};
    this._startOptions = {
      express: option.express || express(),
      webhookUrl: option.webhookUrl || "/webhook",
      port: option.port || 3333
    }
    this._startOptions.express.get(this._startOptions.webhookUrl, this._webhook.bind(this));
    this._startOptions.express.post(this._startOptions.webhookUrl, this._webhook.bind(this));

    if (!option.express) {
      this._startOptions.express.listen(this._startOptions.port, () => {
        logger.debug(`App listening on http://localhost:${(this._startOptions || {}).port} `);
      })
    }
  }

  private async _webhook(_: express.Request, res: express.Response) {
    // TODO : check Instance and start
    try {
      await this._syncInstalls();
    } catch(e) {
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
    let installCounts:any = {}
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
  private onInstanceAttached(instanceName :string) {
    const worker: WorkerInstance = this._allWorkerInstances[instanceName];
    // TODO: Overloadのinstanceがあれば引っ越しさせる
  }

  /**
   * instanceId がidのWorkerが喪失した
   * @param id 
   */
  private onInstanceMissed(instanceName :string) {

    // delete immediately
    const diedWorker: WorkerInstance = this._allWorkerInstances[instanceName];
    delete this._allWorkerInstances[instanceName];

    // Replacing missed instance workers.
    for (const id in this._allInstalls) {
      const managedInstall = this._allInstalls[id];
      if (managedInstall.instanceName === diedWorker.name) {
        const nextWorker = this.bestWorkerInstance()
        managedInstall.instanceName = nextWorker.name;
        managedInstall.status = InstallStatus.Starting;
      }
    }

    // synchronize
    this.synchronize().then().catch( e => {
      logger.error(e);
    });
  }

  /**
   * instanceId がidのWorkerから新しい情報が届いた（定期的に届く）
   * @param id 
   */
  private onInstanceReported(instanceName :string) {
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
      this._interval = setInterval( async () => {
        try {
          await this._syncInstalls();
        } catch (e) {
          logger.error(e);
        }
      }, 60 * 1000);
      this._syncInstalls().then().catch(e=>{
        logger.error(e);
      });
    }
  }

  private _startHealthCheck() {
    setInterval( async () => {
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
        installsApi.push(... await getInstallRequest(this._appToken));
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
        if (!found){
          mustAdds.push(install);
        }
      }
      for (const id in this._allInstalls) {
        let found = false;
        for (const install of installsApi){
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
        logger.debug(`${installsApi.length} \t| ${mustAdds.length} \t| ${updated.length} \t| ${deleted.length}`);
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
          install
        }
        this._allInstalls[install.id] = managedInstall;
      }
      await this.synchronize();

    } catch (e) {
      console.error(e);
    }
    this._syncing = false;
  }

  private async synchronize() {
    let separeted: { [key: string]: InstalledDevice[] } = {};
    for (const id in this._allInstalls) {
      const managedInstall: ManagedInstall = this._allInstalls[id];
      const instanceName = managedInstall.instanceName;
      if (!separeted[instanceName]) {
        separeted[instanceName] = []
      }
      separeted[instanceName].push(managedInstall.install);
    }
    //
    for (const instanceName in separeted) {
      logger.debug(`synchronize sent to ${instanceName} idsCount=${separeted[instanceName].length}`)
      await this.adaptor.synchronize(instanceName, separeted[instanceName]);
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
  //   logger.warn(`healthcheck failed install ${managedInstall.install.id}`)
  // }

  private _onHealthCheckFailedWorkerInstance(workerInstance: WorkerInstance) {
    logger.warn(`healthcheck failed worker ${workerInstance.name}`)
    this.onInstanceMissed(workerInstance.name);
  }
}
