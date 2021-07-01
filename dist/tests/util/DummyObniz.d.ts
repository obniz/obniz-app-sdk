import { IObniz } from '../../Obniz.interface';
export interface DummyObnizLog {
    date: Date;
    eventType: 'close' | 'connect' | 'autoConnectOn' | 'autoConnectOff';
}
export declare class DummyObniz implements IObniz {
    static version: string;
    static obnizes: DummyObniz[];
    __logs: DummyObnizLog[];
    __autoConnect: boolean;
    id: string;
    static __reset(): void;
    constructor(id: string);
    get autoConnect(): boolean;
    set autoConnect(val: boolean);
    closeWait(): Promise<void>;
    connect(): void;
}
