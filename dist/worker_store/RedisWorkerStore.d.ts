import { RedisAdaptor } from '../adaptor/RedisAdaptor';
import { WorkerInstance, WorkerStoreBase } from './WorkerStoreBase';
export declare class RedisWorkerStore extends WorkerStoreBase {
    private _redisAdaptor;
    constructor(adaptor: RedisAdaptor);
    getWorkerInstance(instanceName: string): Promise<WorkerInstance | undefined>;
    getAllWorkerInstances(): Promise<{
        [instanceName: string]: WorkerInstance;
    }>;
    deleteWorkerInstance(instanceName: string): Promise<void>;
}
