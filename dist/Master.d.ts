import { Adaptor } from './adaptor/Adaptor';
import { AppStartOption, Database, DatabaseConfig } from './App';
export declare class Master<T extends Database> {
    adaptor: Adaptor;
    scaleFactor: number;
    private readonly _appToken;
    private _startOptions?;
    private _syncing;
    private _interval?;
    private _allInstalls;
    private _allWorkerInstances;
    constructor(appToken: string, instanceName: string, scaleFactor: number, database: T, databaseConfig: DatabaseConfig[T]);
    start(option?: AppStartOption): void;
    private _startWeb;
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
    private synchronize;
    private _healthCheck;
    private _onHealthCheckFailedWorkerInstance;
}
