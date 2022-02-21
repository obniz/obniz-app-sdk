import { RedisAdaptor } from '../adaptor/RedisAdaptor';
import {
  WorkerInstance,
  WorkerProperties,
  WorkerStoreBase,
} from './WorkerStoreBase';

export class RedisWorkerStore extends WorkerStoreBase {
  private _redisAdaptor: RedisAdaptor;

  constructor(adaptor: RedisAdaptor) {
    super();
    this._redisAdaptor = adaptor;
  }

  public getWorkerInstance(instanceName: string): Promise<WorkerInstance> {
    throw new Error('Method not implemented.');
  }

  public getAllWorkerInstance(): Promise<{
    [instanceName: string]: WorkerInstance;
  }> {
    throw new Error('Method not implemented.');
  }

  public addWorkerInstance(
    instanceName: string,
    props: WorkerProperties
  ): Promise<WorkerInstance> {
    throw new Error('Method not implemented.');
  }

  public updateWorkerInstance(
    instanceName: string,
    props: Partial<WorkerProperties>
  ): Promise<WorkerInstance> {
    throw new Error('Method not implemented.');
  }

  public deleteWorkerInstance(instanceName: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
