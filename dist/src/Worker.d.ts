import Obniz from 'obniz';
export default class Worker {
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
}
