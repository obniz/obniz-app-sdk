import express from 'express';
import { WorkerStatic } from './Worker';
import { Manager as ManagerClass } from './Manager';
import { Installed_Device, Installed_Device as InstalledDevice, User } from 'obniz-cloud-sdk/sdk';
import { IObnizStatic, IObniz, IObnizOptions } from './Obniz.interface';
import { Database, DatabaseConfig } from './adaptor/AdaptorFactory';
import { SdkOption } from 'obniz-cloud-sdk/index';
import { Slave as SlaveClass } from './Slave';
export declare enum AppInstanceType {
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
    Slave = 1
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
export declare type AppOptionInternal<T extends Database, O extends IObniz> = Required<AppOption<T, O>>;
export interface AppStartOption {
    express?: express.Express | false;
    webhookUrl?: string;
    port?: number;
}
export declare class App<O extends IObniz> {
    readonly _options: AppOptionInternal<any, O>;
    protected readonly _manager?: ManagerClass<any>;
    protected readonly _slave?: SlaveClass<O>;
    onInstall?: (user: User, install: InstalledDevice) => Promise<void>;
    onUninstall?: (user: User, install: InstalledDevice) => Promise<void>;
    constructor(option: AppOption<any, O>);
    expressWebhook: (req: express.Request, res: express.Response) => void;
    private _expressWebhook;
    start(option?: AppStartOption): void;
    startWait(option?: AppStartOption): Promise<void>;
    getAllUsers(): Promise<User[]>;
    getAllObnizes(): Promise<O[]>;
    getOnlineObnizes(): Promise<O[]>;
    getOfflineObnizes(): Promise<O[]>;
    getObnizesOnThisInstance(): Promise<O[]>;
    /**
     * Request a results for specified key for working workers.
     * This function is useful when asking live information.
     * @param key string for request
     * @param timeout Sets the timeout in milliseconds. Default is 5000ms.
     * @returns return one object that contains results for keys on each install like {"0000-0000": "result0", "0000-0001": "result1"}
     */
    request(key: string, timeout?: number): Promise<{
        [key: string]: string;
    }>;
    directRequest(obnizId: string, key: string, timeout?: number): Promise<{
        [key: string]: string;
    }>;
    isFirstManager(): boolean;
    doAllRelocate(): Promise<void>;
    get obnizClass(): IObnizStatic<O>;
}
