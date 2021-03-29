import Adaptor from './adaptor/adaptor';
import { AppStartOption } from './App';
export default class Master {
    adaptor: Adaptor;
    scaleFactor: number;
    private _appToken;
    private _startOptions?;
    private _syncing;
    private _interval?;
    private _allInstalls;
    private _allWorkerInstances;
    constructor(appToken: string, instanceName: string, scaleFactor: number);
    start(option?: AppStartOption): void;
    private _startWeb;
    private _webhook;
    /**
     * 空き状況から最適なWorkerを推測
     */
    private bestWorkerInstance;
    /**
     * incetanceId がidのWorkerが新たに参加した
     * @param id
     */
    private onInstanceAttached;
    /**
     * incetanceId がidのWorkerが喪失した
     * @param id
     */
    private onInstanceMissed;
    /**
     * incetanceId がidのWorkerから新しい情報が届いた（定期的に届く）
     * @param id
     */
    private onInstanceReported;
    private _startSynching;
    private _startHealthCheck;
    private _syncInstalls;
    private synchronize;
    private _healthCheck;
    private _onHealthCheckFailedWorkerInstance;
}
