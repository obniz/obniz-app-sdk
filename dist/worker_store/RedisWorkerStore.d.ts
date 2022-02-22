import { RedisAdaptor } from '../adaptor/RedisAdaptor';
import { WorkerInstance, WorkerProperties, WorkerStoreBase } from './WorkerStoreBase';
export declare class RedisWorkerStore extends WorkerStoreBase {
    private _redisAdaptor;
    constructor(adaptor: RedisAdaptor);
    getWorkerInstance(instanceName: string): Promise<WorkerInstance | undefined>;
    getAllWorkerInstances(): Promise<{
        [instanceName: string]: WorkerInstance;
    }>;
    addWorkerInstance(instanceName: string, props: WorkerProperties): Promise<WorkerInstance>;
    updateWorkerInstance(instanceName: string, props: Partial<WorkerProperties>): Promise<WorkerInstance>;
    deleteWorkerInstance(instanceName: string): Promise<void>;
}
