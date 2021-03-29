import Obniz from 'obniz';
import { App } from "./App";
/**
 * This class is exported from this library
 * "Abstract" must be drop
 * Example: https://qiita.com/okdyy75/items/610623943979cf422775#%E3%81%BE%E3%81%82%E3%81%A8%E3%82%8A%E3%81%82%E3%81%88%E3%81%9A%E3%81%A9%E3%82%93%E3%81%AA%E6%84%9F%E3%81%98%E3%81%AB%E6%9B%B8%E3%81%8F%E3%81%AE
 */
export declare abstract class Worker {
    install: any;
    private app;
    constructor(install: any, app: App);
    /**
     * Worker lifecycle
     */
    onStart(): void;
    onLoop(): void;
    onEnd(): void;
    /**
     * obniz lifecycle
     */
    onObnizConnect(obniz: Obniz): void;
    onObnizLoop(obniz: Obniz): void;
    onObnizClose(obniz: Obniz): void;
    stop(): Promise<void>;
}
