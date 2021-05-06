import { App } from './App';
import { ObnizOptions } from 'obniz/dist/src/obniz/ObnizOptions';
import { IObniz } from './Obniz.interface';
import { Installed_Device } from 'obniz-cloud-sdk/sdk';
/**
 * This class is exported from this library
 * "Abstract" must be drop
 * Example: https://qiita.com/okdyy75/items/610623943979cf422775#%E3%81%BE%E3%81%82%E3%81%A8%E3%82%8A%E3%81%82%E3%81%88%E3%81%9A%E3%81%A9%E3%82%93%E3%81%AA%E6%84%9F%E3%81%98%E3%81%AB%E6%9B%B8%E3%81%8F%E3%81%AE
 */
export declare abstract class Worker<O extends IObniz> {
    install: Installed_Device;
    protected app: App<O>;
    protected obniz: O;
    state: 'stopped' | 'starting' | 'started' | 'stopping';
    private readonly _obnizOption;
    constructor(install: Installed_Device, app: App<O>, option?: ObnizOptions);
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
    start(): Promise<void>;
    private _loop;
    stop(): Promise<void>;
}
