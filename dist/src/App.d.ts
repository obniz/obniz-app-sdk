import express from 'express';
declare type Detabase = 'postgresql';
export declare enum AppInstanceType {
    Web = 0,
    Worker = 1
}
export interface AppOption {
    appToken: string;
    database?: Detabase;
    workerClass: new (install: any, app: App) => any;
    instanceType: AppInstanceType;
}
export interface AppStartOption {
    express?: express.Express;
    webhookUrl?: string;
    port?: number;
}
interface User {
}
interface Install {
}
export declare class App {
    private _options;
    private _startOptions?;
    private _syncing;
    private _workers;
    constructor(option: AppOption);
    onInstall(user: User, install: Install): void;
    onUninstall(user: User, install: Install): void;
    start(option?: AppStartOption): void;
    getAllUsers(): void;
    getAllObnizes(): void;
    getOnlineObnizes(): void;
    getOfflineObnizes(): void;
    getObnizesOnThisInstance(): void;
    private _webhook;
    private _startOneWorker;
    private _stopOneWorker;
    private _restartOneWorker;
    private _syncInstalls;
}
export {};
