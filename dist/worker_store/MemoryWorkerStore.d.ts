import { WorkerInstance, WorkerProperties, WorkerStoreBase } from './WorkerStoreBase';
export declare class MemoryWorkerStore extends WorkerStoreBase {
    private _workerInstances;
    getWorkerInstance(instanceName: string): Promise<WorkerInstance | undefined>;
    getAllWorkerInstances(): Promise<{
        [instanceName: string]: WorkerInstance;
    }>;
    addWorkerInstance(instanceName: string, props: WorkerProperties): WorkerInstance;
    updateWorkerInstance(instanceName: string, props: Partial<WorkerProperties>): WorkerInstance;
    deleteWorkerInstance(instanceName: string): Promise<void>;
}
