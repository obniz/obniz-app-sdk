export interface WorkerInstance {
    name: string;
    installIds: string[];
    updatedMillisecond: number;
}
export declare type WorkerProperties = Pick<WorkerInstance, 'installIds' | 'updatedMillisecond'>;
export declare abstract class WorkerStoreBase {
    abstract getWorkerInstance(instanceName: string): Promise<WorkerInstance | undefined>;
    abstract getAllWorkerInstances(): Promise<{
        [instanceName: string]: WorkerInstance;
    }>;
    abstract addWorkerInstance(instanceName: string, props: WorkerProperties): Promise<WorkerInstance>;
    abstract updateWorkerInstance(instanceName: string, props: Partial<WorkerProperties>): Promise<WorkerInstance>;
    abstract deleteWorkerInstance(instanceName: string): Promise<void>;
}
