import express from 'express';
import { WorkerStatic } from './Worker';
import { Installed_Device, Installed_Device as InstalledDevice, User } from 'obniz-cloud-sdk/sdk';
import IORedis from 'ioredis';
import { IObnizStatic, IObniz } from './Obniz.interface';
export interface DatabaseConfig {
    redis: IORedis.RedisOptions;
    memory: {
        limit: number;
    };
}
export declare type Database = keyof DatabaseConfig;
export declare enum AppInstanceType {
    Master = 0,
    Slave = 1
}
export interface AppOption<T extends Database, O extends IObniz> {
    appToken: string;
    database?: T;
    databaseConfig?: DatabaseConfig[T];
    workerClass?: WorkerStatic<O>;
    workerClassFunction?: (install: Installed_Device) => WorkerStatic<O>;
    obnizClass: IObnizStatic<O>;
    instanceType: AppInstanceType;
    instanceName?: string;
    scaleFactor?: number;
}
export interface AppStartOption {
    express?: express.Express;
    webhookUrl?: string;
    port?: number;
}
export declare class App<O extends IObniz> {
    private _options;
    private readonly _master?;
    private _adaptor;
    private _workers;
    private _interval;
    private _syncing;
    isScalableMode: boolean;
    onInstall?: (user: User, install: InstalledDevice) => Promise<void>;
    onUninstall?: (user: User, install: InstalledDevice) => Promise<void>;
    constructor(option: AppOption<any, O>);
    /**
     * Receive Master Generated List and compare current apps.
     * @param installs
     */
    private _synchronize;
    /**
     * Let Master know worker is working.
     */
    private _reportToMaster;
    private _startSyncing;
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
    private _startOneWorker;
    private _startOrRestartOneWorker;
    private _stopOneWorker;
    get obnizClass(): IObnizStatic<O>;
}
