import Obniz from 'obniz'
import express from 'express';
import {WorkerAbstract} from './WorkerAbstract';
import {logger} from './logger'
import {getInstallRequest} from "./install";

type Detabase = 'postgresql';

export interface AppOption {
  appToken: string;
  database?: Detabase;
  workerClass: new (install: any, app:App) => WorkerAbstract;
}

interface AppOptionInternal extends AppOption {
  appToken: string;
  database: Detabase;
}


export interface AppStartOption {
  express?: express.Express;
  webhookUrl?: string;
  port?: number;
}

interface AppStartOptionInternal extends AppStartOption {
  express: express.Express;
  webhookUrl: string;
  port: number;
}

interface User {
}

interface Install {
}


export class App {
  private _options: AppOptionInternal;
  private _startOptions?: AppStartOptionInternal;
  private _syncing: boolean = false;
  private _workers: { [key: string]: WorkerAbstract } = {};

  constructor(option: AppOption) {
    this._options = {
      appToken: option.appToken,
      database: option.database || "postgresql",
      workerClass: option.workerClass
    }

  }


  // 必須なのでオプションでいいのでは
  // registerApplication(workerClass:new () => Worker){
  //
  //
  // }

  onInstall(user: User, install: Install) {

  }

  onUninstall(user: User, install: Install) {

  }

  start(option?: AppStartOption) {
    option = option || {};
    this._startOptions = {
      express: option.express || express(),
      webhookUrl: option.webhookUrl || "/webhook",
      port: option.port || 3333
    }
    this._startOptions.express.get(this._startOptions.webhookUrl, this._webhook);

    if (!option.express) {
      this._startOptions.express.listen(this._startOptions.port, () => {
        const port = this._startOptions ? this._startOptions.port : undefined;
        console.log('Example app listening on port ' + port);
        console.log('localhost:  http://localhost:' + port);
      })
    }
  }


  getAllUsers() {

  }


  getAllObnizes() {

  }


  getOnlineObnizes() {

  }

  getOfflineObnizes() {

  }

  getObnizesOnThisInstance() {

  }


  private _webhook(req: express.Request, res: express.Response, next: express.NextFunction) {
    // TODO : check Instance and start


  }

  private _startOneWorker(worker:WorkerAbstract) {

  }

  private _stopOneWorker(worker:WorkerAbstract) {

  }

  private _restartOneWorker(worker:WorkerAbstract) {

  }

  private async _syncInstalls() {
    try {
      if (this._syncing) {
        return;
      }
      this._syncing = true;

      // logger.debug("sync api start");

      const apiInstalls: any = {};
      let installs_api = [];
      try {
        installs_api = await getInstallRequest(this._options.appToken);
        for (const install of installs_api) {
          apiInstalls[install.id] = install;
        }
      } catch (e) {
        // logger.error(e);
        process.exit();
      }

      // 稼働中の報告があるID一覧
      // logger.debug(`API install ids:    ${JSON.stringify(Object.keys(apiInstalls), null, 2)}`);
      // logger.debug(`working ids:    ${JSON.stringify(Object.keys(this.apps), null, 2)}`);

      const exists: any = {};
      for (const install_id in this._workers) {
        exists[install_id] = this._workers[install_id];
      }

      for (const install_id in apiInstalls) {
        const install = apiInstalls[install_id];
        if (exists[install_id]) {
          const oldApp = this._workers[install_id];
          if (oldApp.install.configs !== install.configs) {
            // config changed
            logger.info(`App config changed id=${install.id}`);
            const app = new this._options.workerClass(install, this);
            this._workers[install.id] = app;
            oldApp
              .stop()
              .then(() => {
              })
              .catch((e) => {
                logger.error(e);
              });
            await this._startOneWorker(app);
          }
          delete exists[install_id];
        } else {
          logger.info(`New App Start id=${install.id}`);
          const app = new this._options.workerClass(install, this);
          this._workers[install.id] = app;
          await this._startOneWorker(app);
        }
      }
      for (const install_id in exists) {
        const oldApp = this._workers[install_id];
        if (oldApp) {
          logger.info(`App Deleted id=${install_id}`);
          delete this._workers[install_id];
          oldApp
            .stop()
            .then(() => {
            })
            .catch((e) => {
              logger.error(e);
            });
        }
      }
    } catch (e) {
      logger.error(e);
    }

    this._syncing = false;
  }

}
