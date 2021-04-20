import { App } from './App';
import { ObnizOptions } from 'obniz/dist/src/obniz/ObnizOptions';
import { ObnizLike, ObnizLikeClass } from './ObnizLike';
import { Installed_Device } from 'obniz-cloud-sdk/sdk';
/**
 * This class is exported from this library
 * "Abstract" must be drop
 * Example: https://qiita.com/okdyy75/items/610623943979cf422775#%E3%81%BE%E3%81%82%E3%81%A8%E3%82%8A%E3%81%82%E3%81%88%E3%81%9A%E3%81%A9%E3%82%93%E3%81%AA%E6%84%9F%E3%81%98%E3%81%AB%E6%9B%B8%E3%81%8F%E3%81%AE
 */
export declare abstract class Worker<O extends ObnizLikeClass> {
    install: Installed_Device;
    protected app: App<O>;
    protected obniz: ObnizLike;
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
    onObnizConnect(obniz: ObnizLike): Promise<void>;
    onObnizLoop(obniz: ObnizLike): Promise<void>;
    onObnizClose(obniz: ObnizLike): Promise<void>;
    start(): Promise<void>;
    private _loop;
    stop(): Promise<void>;
}
