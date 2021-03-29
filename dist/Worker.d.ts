import Obniz from "obniz";
import { App } from "./App";
import { ObnizOptions } from "obniz/dist/src/obniz/ObnizOptions";
/**
 * This class is exported from this library
 * "Abstract" must be drop
 * Example: https://qiita.com/okdyy75/items/610623943979cf422775#%E3%81%BE%E3%81%82%E3%81%A8%E3%82%8A%E3%81%82%E3%81%88%E3%81%9A%E3%81%A9%E3%82%93%E3%81%AA%E6%84%9F%E3%81%98%E3%81%AB%E6%9B%B8%E3%81%8F%E3%81%AE
 */
export declare abstract class Worker {
    install: any;
    protected app: App;
    protected obniz?: Obniz;
    state: "stopped" | "starting" | "started" | "stopping";
    private readonly _obnizOption;
    constructor(install: any, app: App, option?: ObnizOptions);
    /**
     * Worker lifecycle
     */
    onStart(): Promise<void>;
    onLoop(): Promise<void>;
    onEnd(): Promise<void>;
    /**
     * obniz lifecycle
     */
    onObnizConnect(obniz: Obniz): Promise<void>;
    onObnizLoop(obniz: Obniz): Promise<void>;
    onObnizClose(obniz: Obniz): Promise<void>;
    start(): Promise<void>;
    private _loop;
    stop(): Promise<void>;
}
