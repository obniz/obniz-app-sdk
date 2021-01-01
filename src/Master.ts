import {logger} from './logger'
import {getInstallRequest} from "./install";
import { Installed_Device } from 'obniz-cloud-sdk/sdk';
import Adaptor from './adaptor/adaptor';
import RedisAdaptor from './adaptor/redis';
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
  install: Installed_Device;
  status: InstallStatus;
  updatedMilissecond: number;
}

interface WorkerInstance {
  name: string
  installIds: [],
  updatedMilissecond: number;
}

interface AppStartOptionInternal extends AppStartOption {
  express: express.Express;
  webhookUrl: string;
  port: number;
}

export default class Master {
  public adaptor: Adaptor;

  private _appToken:string;
  private _startOptions?: AppStartOptionInternal;
  private _syncing: boolean = false;
  private _interval?: any;
  private _allInstalls: { [key: string]: ManagedInstall } = {};
  private _allWorkerInstances: { [key: string]: WorkerInstance } = {};
  
  constructor(appToken:string, scaleFactor: number){
    this._appToken = appToken;
    if(scaleFactor > 0) {
      const adaptor = new RedisAdaptor('master');
      adaptor.onInstanceInfoUpdated = async (info: any) => {
        const exist = this._allWorkerInstances[info.from];
        if (exist) {
          exist.updatedMilissecond = Date.now().valueOf();
        } else {
          this._allWorkerInstances[info.from] = {
            name: info.from,
            installIds: info.installIds,
            updatedMilissecond: Date.now().valueOf()
          }
        }
      }
      this.adaptor = adaptor
    } else {
      this.adaptor = new Adaptor();
    }
  }

  public start(option?: AppStartOption) {
    this._startWeb(option);
    this._startSynching();
    this._startHealthCheck();
  }

  private _startWeb(option?: AppStartOption) {
    option = option || {};
    this._startOptions = {
      express: option.express || express(),
      webhookUrl: option.webhookUrl || "/webhook",
      port: option.port || 3333
    }
    this._startOptions.express.get(this._startOptions.webhookUrl, this._webhook);
    this._startOptions.express.post(this._startOptions.webhookUrl, this._webhook);

    if (!option.express) {
      this._startOptions.express.listen(this._startOptions.port, () => {
        const port = this._startOptions ? this._startOptions.port : undefined;
      })
    }
  }

  private async _webhook(req: express.Request, res: express.Response, next: express.NextFunction) {
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

  private bestWorkerInstance(): WorkerInstance {
    let minInstall:WorkerInstance | undefined = undefined
    for (const id in this._allWorkerInstances) {
      const workerInstance = this._allWorkerInstances[id];
      if (!minInstall || workerInstance.installIds.length < minInstall.installIds.length) {
        minInstall = workerInstance
      }
    }
    if (!minInstall) {
      throw new Error(`No Instance Found`);
    }
    return minInstall;
  }

  private _startSynching() {
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

      logger.debug("sync api start");

      const installs_api = [];
      try {
        installs_api.push(... await getInstallRequest(this._appToken));
      } catch (e) {
        console.error(e);
        process.exit(-1);
      }

      /**
       * Compare with currents
       */
      const mustaddds: Installed_Device[] = [];
      const updateds: Installed_Device[] = [];
      const deleted: ManagedInstall[] = [];
      for (const install of installs_api) {
        let found = false;
        for (const id in this._allInstalls) {
          const oldInstall = this._allInstalls[id].install;
          if (install.id === id) {
            if (JSON.stringify(install) !== JSON.stringify(oldInstall)) {
              // updated
              updateds.push(install);
            }
            found = true;
            break;
          }
        }
        if (!found){
          mustaddds.push(install);
        }
      }
      for (const id in this._allInstalls) {
        let found = false;
        for (const install of installs_api){ 
          if (id === install.id) {
            found = true;
            break;
          }
        }
        if (!found) {
          deleted.push(this._allInstalls[id]);
        }
      }
      logger.debug(`loaded installs ${installs_api.length}`);
      logger.debug(`new installs ${mustaddds.length}`);
      logger.debug(`updated installs ${updateds.length}`);
      logger.debug(`deleted installs ${deleted.length}`);
      
      for (const install of mustaddds) {
        const instance = this.bestWorkerInstance(); // maybe throw
        const managedInstall: ManagedInstall = {
          instanceName: instance.name,
          status: InstallStatus.Starting,
          updatedMilissecond: Date.now().valueOf(),
          install
        }
        this._allInstalls[install.id] = managedInstall;
        await this.adaptor.start(install, managedInstall.instanceName);
      }
      for (const install of updateds) {
        const managedInstall = this._allInstalls[install.id];
        managedInstall.updatedMilissecond = Date.now().valueOf();
        await this.adaptor.update(install, managedInstall.instanceName);
      }
      for (const managedInstall of deleted) {
        if (managedInstall.status === InstallStatus.Stopping || managedInstall.status === InstallStatus.Stopped) {
          continue;
        }
        managedInstall.updatedMilissecond = Date.now().valueOf();
        managedInstall.status = InstallStatus.Stopping;
        await this.adaptor.stop(managedInstall.install, managedInstall.instanceName);
      }
    } catch (e) {
      logger.error(e);
    }
    this._syncing = false;
  }

  private _healthCheck() {
    const current = Date.now().valueOf();
    // each install
    for (const id in this._allInstalls) {
      const managedInstall = this._allInstalls[id];
      if (managedInstall.updatedMilissecond + 60 * 1000 < current) {
        // over time.
        this._onHealthCheckFailedInstall(managedInstall);
      }
    }
    // each room
    for (const id in this._allWorkerInstances) {
      const workerInstance = this._allWorkerInstances[id];
      if (workerInstance.updatedMilissecond + 60 * 1000 < current) {
        // over time.
        this._onHealthCheckFailedWorkerInstance(workerInstance);
      }
    }
  }

  private _onHealthCheckFailedInstall(managedInstall: ManagedInstall) {
    logger.warn(`healthcheck failed install ${managedInstall.install.id}`)
  }

  private _onHealthCheckFailedWorkerInstance(workerInstance: WorkerInstance) {
    logger.warn(`healthcheck failed worker ${workerInstance.name}`)
  }
}