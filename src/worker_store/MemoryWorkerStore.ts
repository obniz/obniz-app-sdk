import {
  WorkerInstance,
  WorkerProperties,
  WorkerStoreBase,
} from './WorkerStoreBase';

export class MemoryWorkerStore extends WorkerStoreBase {
  private _workerInstances: { [key: string]: WorkerInstance } = {};

  public getWorkerInstance(instanceName: string): Promise<WorkerInstance> {
    const workerInstance = this._workerInstances[instanceName];
    return new Promise((r) => r(workerInstance));
  }

  public getAllWorkerInstance(): Promise<{
    [instanceName: string]: WorkerInstance;
  }> {
    const workerInstances = this._workerInstances;
    return new Promise((r) => r(workerInstances));
  }

  public addWorkerInstance(
    instanceName: string,
    props: WorkerProperties
  ): Promise<WorkerInstance> {
    this._workerInstances[instanceName] = {
      name: instanceName,
      installIds: props.installIds,
      updatedMillisecond: props.updatedMillisecond,
    };
    return new Promise((r) => r(this._workerInstances[instanceName]));
  }

  public updateWorkerInstance(
    instanceName: string,
    props: Partial<WorkerProperties>
  ): Promise<WorkerInstance> {
    this._workerInstances[instanceName] = {
      name: instanceName,
      installIds:
        props.installIds ?? this._workerInstances[instanceName].installIds,
      updatedMillisecond:
        props.updatedMillisecond ??
        this._workerInstances[instanceName].updatedMillisecond,
    };
    return new Promise((r) => r(this._workerInstances[instanceName]));
  }

  public deleteWorkerInstance(instanceName: string): Promise<void> {
    delete this._workerInstances[instanceName];
    return new Promise((r) => r());
  }
}
