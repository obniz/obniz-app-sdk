import express from 'express';
import { Worker, WorkerStatic } from './Worker';
import { Master as MasterClass } from './Master';
import { Adaptor } from './adaptor/Adaptor';
import { Installed_Device, Installed_Device as InstalledDevice, User } from 'obniz-cloud-sdk/sdk';
import { IObnizStatic, IObniz, IObnizOptions } from './Obniz.interface';
import { Database, DatabaseConfig } from './adaptor/AdaptorFactory';
import { SdkOption } from 'obniz-cloud-sdk/index';
export declare enum AppInstanceType {
    Master = 0,
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
declare type AppOptionInternal<T extends Database, O extends IObniz> = Required<AppOption<T, O>>;
export interface AppStartOption {
    express?: express.Express | false;
    webhookUrl?: string;
    port?: number;
}
export declare class App<O extends IObniz> {
    readonly _options: AppOptionInternal<any, O>;
    protected readonly _master?: MasterClass<any>;
    protected _adaptor: Adaptor;
    protected _workers: {
        [key: string]: Worker<O>;
    };
    protected _interval: ReturnType<typeof setTimeout> | null;
    protected _syncing: boolean;
    onInstall?: (user: User, install: InstalledDevice) => Promise<void>;
    onUninstall?: (user: User, install: InstalledDevice) => Promise<void>;
    constructor(option: AppOption<any, O>);
    /**
     * Receive Master Generated List and compare current apps.
     * @param installs
     */
    protected _synchronize(installs: InstalledDevice[]): Promise<void>;
    /**
     * Let Master know worker is working.
     */
    protected _reportToMaster(): Promise<void>;
    protected _startSyncing(): void;
    expressWebhook: (req: express.Request, res: express.Response) => void;
    private _expressWebhook;
    start(option?: AppStartOption): void;
    getAllUsers(): Promise<User[]>;
    getAllObnizes(): Promise<O[]>;
    getOnlineObnizes(): Promise<O[]>;
    getOfflineObnizes(): Promise<O[]>;
    getObnizesOnThisInstance(): Promise<O[]>;
    /**
     * Request a results for specified key for working workers.
     * This function is useful when asking live information.
     * @param key string for request
     * @returns return one object that contains results for keys on each install like {"0000-0000": "result0", "0000-0001": "result1"}
     */
    request(key: string): Promise<{
        [key: string]: string;
    }>;
    protected _startOneWorker(install: InstalledDevice): Promise<void>;
    protected _startOrRestartOneWorker(install: InstalledDevice): Promise<void>;
    protected _stopOneWorker(installId: string): Promise<void>;
    get obnizClass(): IObnizStatic<O>;
}
export {};
