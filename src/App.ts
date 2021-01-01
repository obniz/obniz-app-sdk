import Obniz from 'obniz'
import express from 'express';
import {Worker} from './Worker';
import {logger} from './logger'
import Master from './Master';
import RedisAdaptor from './adaptor/redis';
import Adaptor from './adaptor/adaptor';
import { Installed_Device, User } from 'obniz-cloud-sdk/sdk';

type Detabase = 'postgresql';

export enum AppInstanceType {
  WebAndWorker, // Become an web server and Worker
  Worker, // Worker
}

export interface AppOption {
  appToken: string;
  database?: Detabase;
  workerClass: new (install: any, app:App) => any; //todo:worker abstract
  instanceType: AppInstanceType;
  instanceName?: string;
  scaleFactor?: number; // number of installs.
}

interface AppOptionInternal extends AppOption {
  appToken: string;
  database: Detabase;
  workerClass: new (install: any, app:App) => any; //todo:worker abstract
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
  private _master?: Master;

  // As Worker
  private _adaptor: Adaptor;
  private _workers: { [key: string]: Worker } = {};

  constructor(option: AppOption) {
    this._options = {
      appToken: option.appToken,
      database: option.database || "postgresql",
      workerClass: option.workerClass,
      instanceType: option.instanceType || AppInstanceType.WebAndWorker,
      instanceName: option.instanceName || 'master',
      scaleFactor: option.scaleFactor || 0
    }
    if (option.instanceType === AppInstanceType.WebAndWorker) {
      this._master = new Master(option.appToken, this._options.scaleFactor);
    }
    if(this._options.scaleFactor > 0) {
      this._adaptor = new RedisAdaptor((this._options.instanceName === 'master') ? 'master-worker' : this._options.instanceName);
    } else {
      this._adaptor = this._master!.adaptor
    }
    // on start
    this._adaptor.onStart = async (install: Installed_Device) => {
      logger.info(`App start id=${install.id}`);
      const oldWorker = this._workers[install.id];
      if (oldWorker) {
        oldWorker
          .stop()
          .then(() => {
          })
          .catch((e) => {
            logger.error(e);
          });
      }
      const app = new this._options.workerClass(install, this);
      this._workers[install.id] = app;
      await this._startOneWorker(app);
    }
    // on update
    this._adaptor.onUpdate = async (install: Installed_Device) => {
      logger.info(`App config changed id=${install.id}`);
      const oldWorker = this._workers[install.id];
      if (oldWorker) {
        oldWorker
          .stop()
          .then(() => {
          })
          .catch((e) => {
            logger.error(e);
          });
      }
      const app = new this._options.workerClass(install, this);
      this._workers[install.id] = app;
      await this._restartOneWorker(app); 
    }
    // on stop
    this._adaptor.onStop = async (install: Installed_Device) => {
      logger.info(`App stop id=${install.id}`);
      const oldWorker = this._workers[install.id];
      if (oldWorker) {
        oldWorker
          .stop()
          .then(() => {
          })
          .catch((e) => {
            logger.error(e);
          });
        delete this._workers[install.id];
        await this._stopOneWorker(oldWorker);
      }
    }
  }


  // 必須なのでオプションでいいのでは
  // registerApplication(workerClass:new () => Worker){
  //
  //
  // }

  onInstall(user: User, install: Installed_Device) {

  }

  onUninstall(user: User, install: Installed_Device) {

  }

  start(option?: AppStartOption) {
    if (this._master) {
      this._master.start(option);
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


  private _startOneWorker(worker:Worker) {

  }

  private _stopOneWorker(worker:Worker) {

  }

  private _restartOneWorker(worker:Worker) {

  }

}
