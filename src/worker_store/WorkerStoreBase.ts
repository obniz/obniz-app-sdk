import { Adaptor } from '../adaptor/Adaptor';

export type WorkerInstance = {
  name: string;
  installIds: string[];
  updatedMillisecond: number;
};

export type WorkerProperties = Pick<
  WorkerInstance,
  'installIds' | 'updatedMillisecond'
>;

export abstract class WorkerStoreBase {
  protected adaptor: Adaptor;

  constructor(adaptor: Adaptor) {
    this.adaptor = adaptor;
  }

  public abstract getWorkerInstance(
    instanceName: string
  ): Promise<WorkerInstance>;

  public abstract getAllWorkerInstance(): Promise<{
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