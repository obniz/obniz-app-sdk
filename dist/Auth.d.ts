import express from 'express';
import { Worker } from './Worker';
import { Installed_Device as InstalledDevice, User } from 'obniz-cloud-sdk/sdk';
import IORedis from "ioredis";
export interface DatabaseConfig {
    "redis": IORedis.RedisOptions;
    "memory": {
        limit: number;
    };
}
export declare type Database = keyof DatabaseConfig;
export declare enum AppInstanceType {
    WebAndWorker = 0,
    Worker = 1
}
export interface AppOption<T extends Database> {
    appToken: string;
    database?: T;
    databaseConfig?: DatabaseConfig[T];
    workerClass: new (install: any, app: App) => Worker;
    instanceType: AppInstanceType;
    instanceName?: string;
    scaleFactor?: number;
}
export interface AppStartOption {
    express?: express.Express;
    webhookUrl?: string;
    port?: number;
}
export declare class App {
    private _options;
    private readonly _master?;
    private _adaptor;
    private _workers;
    private _interval;
    private _syncing;
    onInstall?: (user: User, install: InstalledDevice) => Promise<void>;
    onUninstall?: (user: User, install: InstalledDevice) => Promise<void>;
    constructor(option: AppOption<any>);
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
    getAllUsers(): Promise<void>;
    getAllObnizes(): Promise<void>;
    getOnlineObnizes(): Promise<void>;
    getOfflineObnizes(): Promise<void>;
    getObnizesOnThisInstance(): Promise<void>;
    private _startOneWorker;
    private _startOrRestartOneWorker;
    private _stopOneWorker;
}
