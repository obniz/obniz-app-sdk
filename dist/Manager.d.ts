import { Adaptor } from './adaptor/Adaptor';
import express from 'express';
import { AppStartOption } from './App';
import { Database, DatabaseConfig } from './adaptor/AdaptorFactory';
import { SdkOption } from 'obniz-cloud-sdk';
export declare class Manager<T extends Database> {
    adaptor: Adaptor;
    private readonly _appToken;
    private readonly _obnizSdkOption;
    private _startOptions?;
    private _instanceName;
    private _syncing;
    private _syncTimeout;
    private _workerStore;
    private _installStore;
    private _isHeartbeatInit;
    private _isFirstManager;
    private _keyRequestExecutes;
    private _currentAppEventsSequenceNo;
    constructor(appToken: string, instanceName: string, database: T, databaseConfig: DatabaseConfig[T], obnizSdkOption: SdkOption);
    start(option?: AppStartOption): void;
    startWait(option?: AppStartOption): Promise<void>;
    private _startWeb;
    webhook: (req: express.Request, res: express.Response) => Promise<void>;
    private _webhook;
    /**
     * instanceId がidのWorkerが新たに参加した
     * @param id
     */
    private onInstanceAttached;
    /**
     * instanceId がidのWorkerが喪失した
     * @param id
     */
    private onInstanceMissed;
    /**
     * instanceId がidのWorkerから新しい情報が届いた（定期的に届く）
     * @param id
     */
    private onInstanceReported;
    private _startSyncing;
    private _startHealthCheck;
    private _syncInstalls;
    private _checkAllInstalls;
    private _checkDiffInstalls;
    private _addDevice;
    private _updateDevice;
    private _deleteDevice;
    private synchronize;
    private _writeSelfHeartbeat;
    private _healthCheck;
    private _onHealthCheckFailedWorkerInstance;
    hasSubClusteredInstances(): Promise<boolean>;
    request(key: string, timeout: number): Promise<{
        [key: string]: string;
    }>;
    isFirstMaster(): boolean;
}
