import { Adaptor } from '../adaptor/Adaptor';
import { WorkerInstance, WorkerProperties, WorkerStoreBase } from './WorkerStoreBase';
export declare class MemoryWorkerStore extends WorkerStoreBase {
    private _workerInstances;
    constructor(adaptor: Adaptor);
    getWorkerInstance(instanceName: string): Promise<WorkerInstance>;
    getAllWorkerInstance(): Promise<{
        [instanceName: string]: WorkerInstance;
    }>;
    addWorkerInstance(instanceName: string, props: WorkerProperties): Promise<WorkerInstance>;
    updateWorkerInstance(instanceName: string, props: Partial<WorkerProperties>): Promise<WorkerInstance>;
    deleteWorkerInstance(instanceName: string): Promise<void>;
}
