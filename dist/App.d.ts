import express from 'express';
import { Installed_Device, User } from 'obniz-cloud-sdk/sdk';
declare type Detabase = 'postgresql';
export declare enum AppInstanceType {
    WebAndWorker = 0,
    Worker = 1
}
export interface AppOption {
    appToken: string;
    database?: Detabase;
    workerClass: new (install: any, app: App) => any;
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
    private _master?;
    private _adaptor;
    private _workers;
    private _interval;
    private _syncing;
    constructor(option: AppOption);
    /**
     * Receive Master Generated List and compare current apps.
     * @param installs
     */
    private _synchronize;
    /**
     * Let Master know worker is working.
     */
    private _reportToMaster;
    private _startSynching;
    onInstall(user: User, install: Installed_Device): void;
    onUninstall(user: User, install: Installed_Device): void;
    start(option?: AppStartOption): void;
    getAllUsers(): void;
    getAllObnizes(): void;
    getOnlineObnizes(): void;
    getOfflineObnizes(): void;
    getObnizesOnThisInstance(): void;
    private _startOneWorker;
    private _stopOneWorker;
    private _restartOneWorker;
}
export {};
