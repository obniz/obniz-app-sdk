import { RedisAdaptor } from '../adaptor/RedisAdaptor';
import { logger } from '../logger';
import { WorkerInstance, WorkerStoreBase } from './WorkerStoreBase';

export class RedisWorkerStore extends WorkerStoreBase {
  private _redisAdaptor: RedisAdaptor;

  constructor(adaptor: RedisAdaptor) {
    super();
    this._redisAdaptor = adaptor;
  }

  public async getWorkerInstance(
    instanceName: string
  ): Promise<WorkerInstance | undefined> {
    const redis = this._redisAdaptor.getRedisInstance();
    const heartbeat = await redis.get(`slave:${instanceName}:heartbeat`);
    const installIds = await redis.hkeys(`workers:${instanceName}`);
    if (heartbeat === null && installIds === null) return undefined;
    return {
      name: instanceName,
      installIds: installIds ?? [],
      updatedMillisecond: heartbeat === null ? Number(heartbeat) : 1,
    };
  }

  public async getAllWorkerInstances(): Promise<{
    [instanceName: string]: WorkerInstance;
  }> {
    const redis = this._redisAdaptor.getRedisInstance();
    const workingKeys = await redis.keys('slave:*:heartbeat');
    const assignedKeys = await redis.keys('workers:*');
    const instancePartials: {
      [instanceName: string]: Partial<WorkerInstance>;
    } = {};
    for await (const workingKey of workingKeys) {
      const match = workingKey.match(/slave:(?<name>.+):heartbeat/);
      if (match === null || match.groups?.name === undefined) continue;
      const workerName = match.groups.name;
      if (instancePartials[workerName] === undefined)
        instancePartials[workerName] = {};
      const heartbeat = await redis.get(`slave:${workerName}:heartbeat`);
      if (heartbeat === null) continue;
      instancePartials[workerName].updatedMillisecond = Number(heartbeat);
    }
    for await (const assignKey of assignedKeys) {
      const match = assignKey.match(/workers:(?<name>.+)/);
      if (match === null || match.groups?.name === undefined) continue;
      const workerName = match.groups.name;
      if (instancePartials[workerName] === undefined)
        instancePartials[workerName] = {};
      instancePartials[workerName].installIds = await redis.hkeys(
        `workers:${workerName}`
      );
    }
    const instances: {
      [instanceName: string]: WorkerInstance;
    } = {};
    for (const name in instancePartials) {
      const instancePartial = instancePartials[name];
      instances[name] = {
        name,
        installIds: instancePartial.installIds ?? [],
        updatedMillisecond: instancePartial.updatedMillisecond ?? 0,
      };
    }
    return instances;
  }

  public async deleteWorkerInstance(instanceName: string): Promise<void> {
    const redis = this._redisAdaptor.getRedisInstance();
    const res1 = await redis.del(`slave:${instanceName}:heartbeat`);
    const res2 = await redis.del(`workers:${instanceName}`);
    if (res1 > 1) {
      logger.warn(
        `Invalid data detected on ${instanceName}: heartbeat delete operation returned ${res1}`
      );
    }
    if (res2 > 1) {
      logger.warn(
        `Invalid data detected on ${instanceName}: workers delete operation returned ${res2}`
      );
    }
  }
}
