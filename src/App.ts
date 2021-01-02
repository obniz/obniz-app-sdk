import Obniz from 'obniz'
import express from 'express';
import {Worker} from './Worker';
import {logger} from './logger'
import {Master} from './Master';
import {RedisAdaptor} from './adaptor/RedisAdaptor';
import {Adaptor} from './adaptor/Adaptor';
import {Installed_Device as InstalledDevice, User} from 'obniz-cloud-sdk/sdk';

type Database = 'redis';

export enum AppInstanceType {
  WebAndWorker, // Become an web server and Worker
  Worker, // Worker
}

export interface AppOption {
  appToken: string;
  database?: Database;
  workerClass: new (install: any, app: App) => Worker;
  instanceType: AppInstanceType;
  instanceName?: string;
  scaleFactor?: number; // number of installs.
}

interface AppOptionInternal extends AppOption {
  appToken: string;
  database: Database;
  workerClass: new (install: any, app: App) => Worker;
  instanceType: AppInstanceType
  instanceName: string;
  scaleFactor: number; // number of installs.
}


export interface AppStartOption {
  express?: express.Express;
  webhookUrl?: string;
  port?: number;
}

export class App {
  private _options: AppOptionInternal;

  // As Master
  private readonly _master?: Master;

  // As Worker
  private _adaptor: Adaptor;
  private _workers: { [key: string]: Worker } = {};
  private _interval: any
  private _syncing = false


  public onInstall?: (user: User, install: InstalledDevice) => Promise<void>;
  public onUninstall?: (user: User, install: InstalledDevice) => Promise<void>;

  constructor(option: AppOption) {
    this._options = {
      appToken: option.appToken,
      database: option.database || "redis",
      workerClass: option.workerClass,
      instanceType: option.instanceType || AppInstanceType.WebAndWorker,
      instanceName: option.instanceName || 'master',
      scaleFactor: option.scaleFactor || 0
    }

    if (option.instanceType === AppInstanceType.WebAndWorker) {
      this._master = new Master(option.appToken, this._options.instanceName, this._options.scaleFactor);
    }
    if (this._options.scaleFactor > 0) {
      this._adaptor = new RedisAdaptor(this._options.instanceName, false);
    } else {
      // share same adaptor
      this._adaptor = this._master!.adaptor
    }

    this._adaptor.onSynchronize = async (installs: InstalledDevice[]) => {
      await this._synchronize(installs);
    }

    this._adaptor.onReportRequest = async () => {
      await this._reportToMaster();
    }
  }

  /**
   * Receive Master Generated List and compare current apps.
   * @param installs
   */
  private async _synchronize(installs: InstalledDevice[]) {
    try {
      if (this._syncing) {
        return;
      }
      this._syncing = true;

      // logger.debug("receive synchronize message");

      const exists: any = {};
      for (const install_id in this._workers) {
        exists[install_id] = this._workers[install_id];
      }

      for (const install of installs) {
        await this._startOrRestartOneWorker(install);
        if (exists[install.id]) {
          delete exists[install.id];
        }
      }

      // Apps which not listed
      for (const install_id in exists) {
        await this._stopOneWorker(install_id);
      }
    } catch (e) {
      logger.error(e);
    }

    this._syncing = false;
  }

  /**
   * Let Master know worker is working.
   */
  private async _reportToMaster() {
    const keys = Object.keys(this._workers);
    await this._adaptor.report(this._options.instanceName, keys);
  }

  private _startSyncing() {
    // every minutes
    if (!this._interval) {
      this._interval = setInterval(async () => {
        try {
          await this._reportToMaster();
        } catch (e) {
          logger.error(e);
        }
      }, 10 * 1000);
      this._reportToMaster().then().catch(e => {
        logger.error(e);
      });
    }
  }

  start(option?: AppStartOption) {
    if (this._master) {
      this._master.start(option);
    }
    this._startSyncing();
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


  private async _startOneWorker(install: InstalledDevice) {
    logger.info(`New App Start id=${install.id}`);
    const worker = new this._options.workerClass(install, this);
    this._workers[install.id] = worker
    await worker.start();
  }

  private async _startOrRestartOneWorker(install: InstalledDevice) {
      const oldWorker = this._workers[install.id];
      if(oldWorker  && JSON.stringify(oldWorker.install) !== JSON.stringify(install)){
        logger.info(`App config changed id=${install.id}`);
        await this._stopOneWorker(install.id);
        await this._startOneWorker(install);
      }else if(!oldWorker){
        await this._startOneWorker(install);
      }

  }

  private async _stopOneWorker(installId: string) {
    logger.info(`App Deleted id=${installId}`);
    const worker = this._workers[installId];
    if (worker) {
      delete this._workers[installId];

      //background
      worker
        .stop()
        .then(() => {
        })
        .catch((e) => {
          logger.error(e);
        });
    }
  }



}
