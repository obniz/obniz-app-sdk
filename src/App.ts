import express from 'express';
import { Worker, WorkerStatic } from './Worker';
import { logger } from './logger';
import { Master as MasterClass } from './Master';
import { Adaptor } from './adaptor/Adaptor';
import {
  Installed_Device,
  Installed_Device as InstalledDevice,
  User,
} from 'obniz-cloud-sdk/sdk';
import { IObnizStatic, IObniz, IObnizOptions } from './Obniz.interface';
import semver from 'semver';
import {
  AdaptorFactory,
  Database,
  DatabaseConfig,
} from './adaptor/AdaptorFactory';
import { SdkOption } from 'obniz-cloud-sdk/index';

export enum AppInstanceType {
  Master,
  Slave,
}

import * as os from 'os';
export interface AppOption<T extends Database, O extends IObniz> {
  appToken: string;
  database?: T;
  databaseConfig?: DatabaseConfig[T];
  workerClass?: WorkerStatic<O>;
  workerClassFunction?: (install: Installed_Device) => WorkerStatic<O>;
  obnizClass: IObnizStatic<O>;
  instanceType: AppInstanceType;

  /**
   * Define Instance Name instead of default os.hostname()
   */
  instanceName?: string;

  /**
   * Maximum number of workers single instance handle.
   * This may exceed if not enough instances are avaialble.
   * Too much number may use machine cpu/memory/bandwidh resources.
   * This very depends on worker code. 10-2000 are estimated range. you may starts from 100 and adjust that number by resource usage.
   */
  maxWorkerNumPerInstance?: number; // number of installs.

  obnizOption?: IObnizOptions;
  obnizCloudSdkOption?: SdkOption;
}

type AppOptionInternal<T extends Database, O extends IObniz> = Required<
  AppOption<T, O>
>;

export interface AppStartOption {
  express?: express.Express | false;
  webhookUrl?: string;
  port?: number;
}

export class App<O extends IObniz> {
  readonly _options: AppOptionInternal<any, O>;

  // As Master
  protected readonly _master?: MasterClass<any>;

  // As Worker
  protected _adaptor: Adaptor;
  protected _workers: { [key: string]: Worker<O> } = {};
  protected _interval: ReturnType<typeof setTimeout> | null = null;
  protected _syncing = false;

  public isScalableMode = false;

  // eslint-disable-next-line no-unused-vars
  public onInstall?: (user: User, install: InstalledDevice) => Promise<void>;
  // eslint-disable-next-line no-unused-vars
  public onUninstall?: (user: User, install: InstalledDevice) => Promise<void>;

  constructor(option: AppOption<any, O>) {
    // validate obniz.js
    const requiredObnizJsVersion = '3.15.0-alpha.1';
    if (
      semver.satisfies(option.obnizClass.version, `<${requiredObnizJsVersion}`)
    ) {
      throw new Error(
        `obniz.js version > ${requiredObnizJsVersion} is required, but current is ${option.obnizClass.version}`
      );
    }

    // bind default values.
    this._options = {
      appToken: option.appToken,
      database: option.database || 'memory',
      databaseConfig: option.databaseConfig,
      workerClass: option.workerClass || Worker,
      workerClassFunction:
        option.workerClassFunction ||
        (() => {
          return this._options.workerClass;
        }),
      obnizClass: option.obnizClass,
      instanceType: option.instanceType || AppInstanceType.Master,
      instanceName: option.instanceName || os.hostname(),
      maxWorkerNumPerInstance: option.maxWorkerNumPerInstance || 0,
      obnizOption: option.obnizOption || {},
      obnizCloudSdkOption: option.obnizCloudSdkOption || {},
    };

    if (option.instanceType === AppInstanceType.Master) {
      this._master = new MasterClass(
        option.appToken,
        this._options.instanceName,
        this._options.maxWorkerNumPerInstance,
        this._options.database,
        this._options.databaseConfig,
        this._options.obnizCloudSdkOption
      );
    }
    this.isScalableMode = this._options.maxWorkerNumPerInstance > 0;
    if (this._master) {
      // share same adaptor
      this._adaptor = this._master.adaptor;
    } else if (this.isScalableMode) {
      if (this._options.database !== 'redis') {
        throw new Error('only support database redis when using scalable mode');
      }
      this._adaptor = new AdaptorFactory().create(
        this._options.database,
        this._options.instanceName,
        false,
        this._options.databaseConfig
      );
    } else {
      throw new Error('invalid options');
    }

    this._adaptor.onSynchronize = async (installs: InstalledDevice[]) => {
      await this._synchronize(installs);
    };

    this._adaptor.onReportRequest = async () => {
      await this._reportToMaster();
    };

    this._adaptor.onRequestRequested = async (
      key: string
    ): Promise<{ [key: string]: string }> => {
      const results: { [key: string]: string } = {};
      for (const install_id in this._workers) {
        results[install_id] = await this._workers[install_id].onRequest(key);
      }
      return results;
    };
  }

  /**
   * Receive Master Generated List and compare current apps.
   * @param installs
   */
  protected async _synchronize(installs: InstalledDevice[]): Promise<void> {
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
  protected async _reportToMaster(): Promise<void> {
    const keys = Object.keys(this._workers);
    await this._adaptor.report(this._options.instanceName, keys);
  }

  protected _startSyncing(): void {
    // every minutes
    if (!this._interval) {
      this._interval = setInterval(async () => {
        try {
          await this._reportToMaster();
        } catch (e) {
          logger.error(e);
        }
      }, 10 * 1000);
      this._reportToMaster()
        .then()
        .catch((e) => {
          logger.error(e);
        });
    }
  }

  expressWebhook = this._expressWebhook.bind(this);

  private _expressWebhook(req: express.Request, res: express.Response): void {
    this._master?.webhook(req, res);
  }

  start(option?: AppStartOption): void {
    if (this._master) {
      this._master.start(option);
    }
    this._startSyncing();
  }

  async getAllUsers(): Promise<User[]> {
    throw new Error('TODO');
  }

  async getAllObnizes(): Promise<O[]> {
    throw new Error('TODO');
  }

  async getOnlineObnizes(): Promise<O[]> {
    throw new Error('TODO');
  }

  async getOfflineObnizes(): Promise<O[]> {
    throw new Error('TODO');
  }

  async getObnizesOnThisInstance(): Promise<O[]> {
    throw new Error('TODO');
  }

  /**
   * Request a results for specified key for working workers.
   * This function is useful when asking live information.
   * @param key string for request
   * @returns return one object that contains results for keys on each install like {"0000-0000": "result0", "0000-0001": "result1"}
   */
  public async request(key: string): Promise<{ [key: string]: string }> {
    if (this.isScalableMode) {
      throw new Error(`request for scalableMode is not supported yet`);
    }
    return await this._adaptor.request(key);
  }

  protected async _startOneWorker(install: InstalledDevice): Promise<void> {
    logger.info(`New Worker Start id=${install.id}`);

    const wclass = this._options.workerClassFunction(install);
    const worker = new wclass(install, this, {
      ...this._options.obnizOption,
      access_token: this._options.appToken,
    });

    this._workers[install.id] = worker;
    await worker.start();
  }

  protected async _startOrRestartOneWorker(
    install: InstalledDevice
  ): Promise<void> {
    const oldWorker = this._workers[install.id];
    if (
      oldWorker &&
      JSON.stringify(oldWorker.install) !== JSON.stringify(install)
    ) {
      logger.info(`App config changed id=${install.id}`);
      await this._stopOneWorker(install.id);
      await this._startOneWorker(install);
    } else if (!oldWorker) {
      await this._startOneWorker(install);
    }
  }

  protected async _stopOneWorker(installId: string): Promise<void> {
    logger.info(`App Deleted id=${installId}`);
    const worker = this._workers[installId];
    if (worker) {
      delete this._workers[installId];

      // background
      worker
        .stop()
        .then(() => {})
        .catch((e) => {
          logger.error(e);
        });
    }
  }

  public get obnizClass(): IObnizStatic<O> {
    return this._options.obnizClass;
  }
}
