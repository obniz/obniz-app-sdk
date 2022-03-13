import express from 'express';
import * as os from 'os';

import semver from 'semver';

import { Worker, WorkerStatic } from './Worker';
import { logger } from './logger';
import { Manager as ManagerClass } from './Manager';
import { Adaptor } from './adaptor/Adaptor';
import {
  Installed_Device,
  Installed_Device as InstalledDevice,
  User,
} from 'obniz-cloud-sdk/sdk';
import { IObnizStatic, IObniz, IObnizOptions } from './Obniz.interface';
import {
  AdaptorFactory,
  Database,
  DatabaseConfig,
} from './adaptor/AdaptorFactory';
import { SdkOption } from 'obniz-cloud-sdk/index';

export enum AppInstanceType {
  /**
   * Master is Manager + Slave. It communicate with obnizCloud and also works as a worker.
   */
  Master = 0,

  /**
   * Manager is managing workers. Never taking a task itself.
   */
  Manager = 2,

  /**
   * Working class. worker needs Manager or Master.
   */
  Slave = 1,
}

export interface AppOption<T extends Database, O extends IObniz> {
  /**
   * App Token provided from obniz Cloud.
   */
  appToken: string;

  /**
   * Clustering Method.
   */
  database?: T;

  /**
   * Options for database.
   */
  databaseConfig?: DatabaseConfig[T];

  /**
   * Your Worker Class. instantiate for each obniz devices.
   */
  workerClass?: WorkerStatic<O>;

  /**
   * TODO
   */
  workerClassFunction?: (install: Installed_Device) => WorkerStatic<O>;

  /**
   * obniz Class used with your workerClass.
   */
  obnizClass: IObnizStatic<O>;

  /**
   * Master: Master is Manager + Slave. It communicate with obnizCloud and also works as a worker.
   * Manager: Manager is managing workers. Never taking a task itself.
   * Slave: Working class. worker needs Manager or Master.
   */
  instanceType: AppInstanceType;

  /**
   * Define Instance Name instead of default os.hostname()
   */
  instanceName?: string;

  /**
   * Options for obniz.js instance arg
   */
  obnizOption?: IObnizOptions;

  /**
   * Options for obniz Cloud SDK
   */
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
  protected readonly _manager?: ManagerClass<any>;

  // As Worker
  protected _adaptor: Adaptor;
  protected _workers: { [key: string]: Worker<O> } = {};
  protected _interval: ReturnType<typeof setTimeout> | null = null;
  protected _syncing = false;

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
      obnizOption: option.obnizOption || {},
      obnizCloudSdkOption: option.obnizCloudSdkOption || {},
    };

    // detection of pm2 cluster enabled.
    const pm2ClusterEnabled = typeof process.env.NODE_APP_INSTANCE === 'string';
    const isMasterOnSameMachine =
      !pm2ClusterEnabled || process.env.NODE_APP_INSTANCE === '0';

    if (pm2ClusterEnabled) {
      logger.info(
        `cluster detected. Instance Number = ${process.env.NODE_APP_INSTANCE}`
      );
      // make unique in same machine
      this._options.instanceName += `-${process.env.NODE_APP_INSTANCE}`;
    }

    if (
      (option.instanceType === AppInstanceType.Master ||
        option.instanceType === AppInstanceType.Manager) &&
      isMasterOnSameMachine
    ) {
      this._manager = new ManagerClass(
        option.appToken,
        this._options.instanceName,
        this._options.database,
        this._options.databaseConfig,
        this._options.obnizCloudSdkOption
      );
    }

    if (this._manager) {
      // share same adaptor
      this._adaptor = this._manager.adaptor;
    } else {
      this._adaptor = new AdaptorFactory().create(
        this._options.database,
        this._options.instanceName,
        false,
        this._options.databaseConfig
      );
    }

    this._adaptor.onSynchronize = async (installs: InstalledDevice[]) => {
      await this._synchronize(installs);
    };

    this._adaptor.onReportRequest = async () => {
      await this._reportToManager();
    };

    this._adaptor.onKeyRequest = async (requestId: string, key: string) => {
      await this._keyRequestProcess(requestId, key);
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

  protected async _keyRequestProcess(
    requestId: string,
    key: string
  ): Promise<void> {
    const results: { [key: string]: string } = {};
    for (const install_id in this._workers) {
      results[install_id] = await this._workers[install_id].onRequest(key);
    }
    await this._adaptor.keyRequestResponse(
      requestId,
      this._options.instanceName,
      results
    );
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
  protected async _reportToManager(): Promise<void> {
    /**
     * Only Report status and letting master know i am exist when worker or master.
     */
    if (
      !this._manager ||
      (this._manager && this._options.instanceType === AppInstanceType.Master)
    ) {
      const keys = Object.keys(this._workers);
      await this._adaptor.report(this._options.instanceName, keys);
    }
  }

  protected _startSyncing(): void {
    // every minutes
    if (!this._interval) {
      this._interval = setInterval(async () => {
        try {
          await this._reportToManager();
        } catch (e) {
          logger.error(e);
        }
      }, 10 * 1000);
      this._reportToManager()
        .then()
        .catch((e) => {
          logger.error(e);
        });
    }
  }

  expressWebhook = this._expressWebhook.bind(this);

  private _expressWebhook(req: express.Request, res: express.Response): void {
    this._manager?.webhook(req, res);
  }

  start(option?: AppStartOption): void {
    if (this._manager) {
      this._manager.start(option);
    }
    if (
      this._options.instanceType === AppInstanceType.Master ||
      this._options.instanceType === AppInstanceType.Manager
    ) {
      this._startSyncing();
    }
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
   * @param timeout Sets the timeout in milliseconds. Default is 5000ms.
   * @returns return one object that contains results for keys on each install like {"0000-0000": "result0", "0000-0001": "result1"}
   */
  public async request(
    key: string,
    timeout = 30 * 1000
  ): Promise<{ [key: string]: string }> {
    if (!this._manager) {
      throw new Error(`This function is only available on master`);
    }
    return await this._manager.request(key, timeout);
  }

  protected async _startOneWorker(
    install: InstalledDevice,
    onInstall: boolean
  ): Promise<void> {
    logger.info(`New Worker Start id=${install.id}`);

    let access_token = this._options.appToken;

    // @ts-ignore
    if (this._appTokenForObniz) {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      access_token = this._appTokenForObniz(install);
    }

    const wclass = this._options.workerClassFunction(install);
    const worker = new wclass(install, this, {
      ...this._options.obnizOption,
      access_token,
    });

    this._workers[install.id] = worker;
    await worker.start(onInstall);
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
      await this._startOneWorker(install, false);
    } else if (!oldWorker) {
      // TODO: Should detect new install or just starting Application.
      await this._startOneWorker(install, true);
    }
  }

  protected async _stopOneWorker(installId: string): Promise<void> {
    logger.info(`App Deleted id=${installId}`);
    const worker = this._workers[installId];
    if (worker) {
      delete this._workers[installId];

      const stop = async () => {
        try {
          await worker.stop();
        } catch (e) {
          logger.error(e);
        }
        try {
          await worker.onUnInstall();
        } catch (e) {
          logger.error(e);
        }
      };

      // background
      stop().then(() => {});
    }
  }

  public get obnizClass(): IObnizStatic<O> {
    return this._options.obnizClass;
  }
}
