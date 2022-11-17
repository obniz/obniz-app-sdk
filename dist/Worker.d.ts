import { App } from './App';
import { IObniz, IObnizOptions } from './Obniz.interface';
import { Installed_Device, User } from 'obniz-cloud-sdk/sdk';
/**
 * This class is exported from this library
 * "Abstract" must be drop
 * Example: https://qiita.com/okdyy75/items/610623943979cf422775#%E3%81%BE%E3%81%82%E3%81%A8%E3%82%8A%E3%81%82%E3%81%88%E3%81%9A%E3%81%A9%E3%82%93%E3%81%AA%E6%84%9F%E3%81%98%E3%81%AB%E6%9B%B8%E3%81%8F%E3%81%AE
 */
export declare class Worker<O extends IObniz> {
    install: Installed_Device;
    protected app: App<O>;
    protected obniz: O;
    state: 'stopped' | 'starting' | 'started' | 'stopping';
    protected readonly _obnizOption: IObnizOptions;
    user: User;
    private _cloudSdk;
    constructor(install: Installed_Device, app: App<O>, option?: IObnizOptions);
    /**
     * Worker lifecycle
     */
    /**
     * Called When newaly Installed
     * This will be called before onStart after instantiated.
     * Introduces from v1.4.0
     */
    onInstall(): Promise<void>;
    /**
     * Called When Uninstalled
     * This will be called before onEnd()
     * Introduces from v1.4.0
     */
    onUnInstall(): Promise<void>;
    /**
     * Worker lifecycle
     */
    onStart(): Promise<void>;
    /**
     * This funcion will be called rrepeatedly while App is started.
     */
    onLoop(): Promise<void>;
    onEnd(): Promise<void>;
    /**
     *
     * @param key string key that represents what types of reqeust.
     * @returns string for requested key
     */
    onRequest(key: string): Promise<string>;
    /**
     * obniz lifecycle
     */
    onObnizConnect(obniz: O): Promise<void>;
    onObnizLoop(obniz: O): Promise<void>;
    onObnizClose(obniz: O): Promise<void>;
    /**
     * Start Application by recofnizing Install/Update
     * @param onInstall if start reason is new install then true;
     */
    start(onInstall?: boolean): Promise<void>;
    private _loop;
    stop(): Promise<void>;
    protected statusUpdateWait(status: 'success' | 'error', text: string): Promise<void>;
    protected addLogQueue(level: 'info' | 'error', message: string): void;
    cloudLog: {
        info: (message: string) => void;
        error: (message: string) => void;
    };
}
export type WorkerStatic<O extends IObniz> = new (install: Installed_Device, app: App<O>, option: IObnizOptions) => Worker<O>;
