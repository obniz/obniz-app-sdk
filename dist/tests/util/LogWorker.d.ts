import { Worker } from '../../Worker';
import { DummyObniz } from './DummyObniz';
import { Installed_Device } from 'obniz-cloud-sdk/sdk';
import { App } from '../../App';
import { IObnizOptions } from '../../Obniz.interface';
export declare type WorkerLogEventType = 'onStart' | 'onLoop' | 'onEnd' | 'onRequest' | 'onObnizConnect' | 'onObnizLoop' | 'onObnizClose';
export interface WorkerLog {
    obnizId: string;
    date: Date;
    eventType: WorkerLogEventType;
    requestVal?: string;
}
export declare class LogWorker extends Worker<DummyObniz> {
    static workers: LogWorker[];
    __logs: WorkerLog[];
    __addedObnizLoopEvent: boolean;
    __addedLoopEvent: boolean;
    static __reset(): void;
    constructor(install: Installed_Device, app: App<DummyObniz>, option?: IObnizOptions);
    __getOption(): IObnizOptions;
    onStart(): Promise<void>;
    onLoop(): Promise<void>;
    onEnd(): Promise<void>;
    onRequest(key: string): Promise<string>;
    onObnizConnect(obniz: DummyObniz): Promise<void>;
    onObnizLoop(obniz: DummyObniz): Promise<void>;
    onObnizClose(obniz: DummyObniz): Promise<void>;
    protected __addLog(eventType: WorkerLogEventType, requestVal?: string): void;
}
