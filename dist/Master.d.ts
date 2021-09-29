import { Adaptor } from './adaptor/Adaptor';
import { AppStartOption } from './App';
import { Database, DatabaseConfig } from './adaptor/AdaptorFactory';
import { SdkOption } from 'obniz-cloud-sdk';
export declare class Master<T extends Database> {
    adaptor: Adaptor;
    private readonly _appToken;
    private readonly _obnizSdkOption;
    private _startOptions?;
    private _syncing;
    private _syncTimeout;
    private _allInstalls;
    private _allWorkerInstances;
    private _currentAppEventsSequenceNo;
    constructor(appToken: string, instanceName: string, database: T, databaseConfig: DatabaseConfig[T], obnizSdkOption: SdkOption);
    start(option?: AppStartOption): void;
    private _startWeb;
    webhook: any;
    private _webhook;
    /**
     * 空き状況から最適なWorkerを推測
     */
    private bestWorkerInstance;
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
    private _healthCheck;
    private _onHealthCheckFailedWorkerInstance;
    hasSubClusteredInstances(): boolean;
}
