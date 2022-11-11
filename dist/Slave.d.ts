import { IObniz } from './Obniz.interface';
import { Adaptor } from './adaptor/Adaptor';
import { Worker } from './Worker';
import { Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';
import { App } from './App';
import { MessageBodies } from './utils/message';
export declare class Slave<O extends IObniz> {
    protected readonly _adaptor: Adaptor;
    protected readonly _instanceName: string;
    protected readonly _app: App<O>;
    protected _workers: {
        [key: string]: Worker<O>;
    };
    protected _interval: ReturnType<typeof setTimeout> | null;
    protected _syncing: boolean;
    constructor(_adaptor: Adaptor, _instanceName: string, _app: App<O>);
    private bindAdaptorCallbacks;
    protected _keyRequestProcess(masterName: string, requestId: string, key: string, obnizId?: string): Promise<void>;
    private _getInstallsFromRedis;
    /**
     * Receive Master Generated List and compare current apps.
     */
    protected _synchronize(options: MessageBodies['synchronize']): Promise<void>;
    protected _startOneWorker(install: InstalledDevice): Promise<void>;
    protected _startOrRestartOneWorker(install: InstalledDevice): Promise<void>;
    protected _stopOneWorker(installId: string): Promise<void>;
    protected _onHeartBeat(): Promise<void>;
    /**
     * Let Master know worker is working.
     */
    protected _reportToMaster(masterName: string): Promise<void>;
    startSyncing(): void;
}
