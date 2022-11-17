export interface WorkerInstance {
    name: string;
    installIds: string[];
    updatedMillisecond: number;
}
export type WorkerProperties = Pick<WorkerInstance, 'installIds' | 'updatedMillisecond'>;
export declare abstract class WorkerStoreBase {
    abstract getWorkerInstance(instanceName: string): Promise<WorkerInstance | undefined>;
    abstract getAllWorkerInstances(): Promise<{
        [instanceName: string]: WorkerInstance;
    }>;
    abstract deleteWorkerInstance(instanceName: string): Promise<void>;
}
