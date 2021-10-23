import express from 'express';
import * as os from 'os';

import semver from 'semver';

import { Worker, WorkerStatic } from './Worker';
import { logger } from './logger';
import { Master as MasterClass } from './Master';
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
import { Slave as SlaveClass } from './Slave';

export enum AppInstanceType {
  Master,
  Slave,
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
   * Master: Master is special Worker. Only one master is required in cluster. Master will communicate with cloud and direct clusters.
   * Slave: Worker process. Only communicate with Master.
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

export type AppOptionInternal<T extends Database, O extends IObniz> = Required<
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
  protected readonly _slave: SlaveClass<O>;
  // protected _adaptor: Adaptor;
  // protected _workers: { [key: string]: Worker<O> } = {};
  // protected _interval: ReturnType<typeof setTimeout> | null = null;
  // protected _syncing = false;

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
      option.instanceType === AppInstanceType.Master &&
      isMasterOnSameMachine
    ) {
      this._master = new MasterClass(
        option.appToken,
        this._options.instanceName,
        this._options.database,
        this._options.databaseConfig,
        this._options.obnizCloudSdkOption
      );
    }

    // If master mode, share adaptor
    const adaptor = this._master
      ? this._master.adaptor
      : new AdaptorFactory().create(
          this._options.database,
          this._options.instanceName,
          false,
          this._options.databaseConfig
        );

    this._slave = new SlaveClass<O>(adaptor, this._options.instanceName, this);
  }

  expressWebhook = this._expressWebhook.bind(this);

  private _expressWebhook(req: express.Request, res: express.Response): void {
    this._master?.webhook(req, res);
  }

  start(option?: AppStartOption): void {
    if (this._master) {
      this._master.start(option);
    }
    this._slave.startSyncing();
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
    if (!this._master) {
      throw new Error(`This function is only available on master`);
    }
    return await this._master.request(key, timeout);
  }

  public get obnizClass(): IObnizStatic<O> {
    return this._options.obnizClass;
  }
}
