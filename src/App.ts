import express from 'express';
import * as os from 'os';

import semver from 'semver';

import { Worker, WorkerStatic } from './Worker';
import { logger } from './logger';
import { Manager as ManagerClass } from './Manager';
import { User } from 'obniz-cloud-sdk/sdk';
import { IObnizStatic, IObniz, IObnizOptions } from './Obniz.interface';
import {
  AdaptorFactory,
  Database,
  DatabaseConfig,
} from './adaptor/AdaptorFactory';
import { SdkOption } from 'obniz-cloud-sdk/index';
import { Slave as SlaveClass } from './Slave';
import { DeviceInfo } from './types/device';
import { FetcherFunction } from './types/fetcher';

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
  workerClassFunction?: (deviceInfo: DeviceInfo) => WorkerStatic<O>;

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

export interface AppCustomOption<T extends Database, O extends IObniz> {
  /**
   * Override obniz list get function
   */
  fetcher?: FetcherFunction;
}

export type AppOptionInternal<T extends Database, O extends IObniz> = Required<
  AppOption<T, O>
> &
  AppCustomOption<T, O>;

export interface AppStartOption {
  express?: express.Express | false;
  webhookUrl?: string;
  port?: number;
}

export class App<O extends IObniz> {
  readonly _options: AppOptionInternal<any, O> & AppCustomOption<any, O>;

  // As Master
  protected readonly _manager?: ManagerClass;

  // As Worker
  protected readonly _slave?: SlaveClass<O>;
  // protected _adaptor: Adaptor;
  // protected _workers: { [key: string]: Worker<O> } = {};
  // protected _interval: ReturnType<typeof setTimeout> | null = null;
  // protected _syncing = false;

  // eslint-disable-next-line no-unused-vars
  public onInstall?: (user: User, deviceInfo: DeviceInfo) => Promise<void>;
  // eslint-disable-next-line no-unused-vars
  public onUninstall?: (user: User, deviceInfo: DeviceInfo) => Promise<void>;

  constructor(option: AppOption<any, O> & AppCustomOption<any, O>) {
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
      instanceType: option.instanceType ?? AppInstanceType.Master,
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

    const hasManager =
      (option.instanceType === AppInstanceType.Master ||
        option.instanceType === AppInstanceType.Manager) &&
      isMasterOnSameMachine;

    const adaptor = new AdaptorFactory().create(
      this._options.database,
      this._options.instanceName,
      option.instanceType,
      this._options.databaseConfig
    );

    if (hasManager) {
      this._manager = new ManagerClass({
        appToken: this._options.appToken,
        instanceName: this._options.instanceName,
        adaptor,
        obnizSdkOption: this._options.obnizCloudSdkOption,
        customObnizFetcher: option.fetcher,
      });
    }

    if (option.instanceType !== AppInstanceType.Manager) {
      this._slave = new SlaveClass<O>(
        adaptor,
        this._options.instanceName,
        this
      );
    }
  }

  expressWebhook = this._expressWebhook.bind(this);

  private _expressWebhook(req: express.Request, res: express.Response): void {
    this._manager?.webhook(req, res);
  }

  start(option?: AppStartOption): void {
    this.startWait(option)
      .then(() => {})
      .catch((e) => {
        if (e instanceof Error) {
          throw e;
        } else {
          logger.error('ErrorOnStarting', e);
        }
      });
  }

  async startWait(option?: AppStartOption): Promise<void> {
    if (this._manager) {
      await this._manager.startWait(option);
      logger.info('ManagerClass started');
    }
    if (this._slave) {
      this._slave.startSyncing();
      logger.info('SlaveClass started');
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

  public async directRequest(
    obnizId: string,
    key: string,
    timeout = 30 * 1000
  ): Promise<{ [key: string]: string }> {
    if (!this._manager) {
      throw new Error(`This function is only available on master`);
    }
    return await this._manager.directRequest(obnizId, key, timeout);
  }

  public isFirstManager(): boolean {
    if (!this._manager) {
      throw new Error(`This function is only available on master`);
    }
    return this._manager.isFirstMaster();
  }

  public async doAllRelocate(): Promise<void> {
    if (!this._manager) {
      throw new Error(`This function is only available on master`);
    }
    await this._manager.doAllRelocate();
  }

  public get obnizClass(): IObnizStatic<O> {
    return this._options.obnizClass;
  }

  public async shutdown(): Promise<void> {
    logger.info('App shutting down...');
    if (this._manager) await this._manager.onShutdown();
    if (this._slave) await this._slave.onShutdown();
    logger.info('App shut down successfully');
  }
}
