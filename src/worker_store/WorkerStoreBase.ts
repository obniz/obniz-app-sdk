export interface WorkerInstance {
  name: string;
  installIds: string[];
  updatedMillisecond: number;
}

export type WorkerProperties = Pick<
  WorkerInstance,
  'installIds' | 'updatedMillisecond'
>;

export abstract class WorkerStoreBase {
  public abstract getWorkerInstance(
    instanceName: string
  ): Promise<WorkerInstance | undefined>;

  public abstract getAllWorkerInstances(): Promise<{
    [instanceName: string]: WorkerInstance;
  }>;

  public abstract addWorkerInstance(
    instanceName: string,
    props: WorkerProperties
  ): Promise<WorkerInstance>;

  public abstract updateWorkerInstance(
    instanceName: string,
    props: Partial<WorkerProperties>
  ): Promise<WorkerInstance>;

  public abstract deleteWorkerInstance(instanceName: string): Promise<void>;
}
