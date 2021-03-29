import Obniz from 'obniz';
import { App } from "./App";
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
