import { RedisAdaptor } from '../adaptor/RedisAdaptor';
import { logger } from '../logger';
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

  public async getWorkerInstance(
    instanceName: string
  ): Promise<WorkerInstance | undefined> {
    const redis = this._redisAdaptor.getRedisInstance();
    const heartbeat = await redis.get(`slave:${instanceName}:heartbeat`);
    const installIdsJson = await redis.get(`slave:${instanceName}:install-ids`);
    if (heartbeat === null && installIdsJson === null) return undefined;
    return {
      name: instanceName,
      installIds:
        installIdsJson === null ? [] : (JSON.parse(installIdsJson) as string[]),
      updatedMillisecond: heartbeat === null ? Number(heartbeat) : 1,
    };
  }

  public async getAllWorkerInstances(): Promise<{
    [instanceName: string]: WorkerInstance;
  }> {
    const redis = this._redisAdaptor.getRedisInstance();
    // FIXME: Using keys
    const keys = await redis.keys('slave:*');
    const instancePartials: {
      [instanceName: string]: Partial<WorkerInstance>;
    } = {};
    for await (const key of keys) {
      const match = key.match(/slave:(?<name>.*):(?<type>.*)/);
      if (
        match === null ||
        match.groups?.name === undefined ||
        match.groups?.type === undefined
      ) {
        continue;
      }
      const instanceName = match.groups.name;
      const type = match.groups.type;

      if (instancePartials[instanceName] === undefined)
        instancePartials[instanceName] = {};

      if (type === 'heartbeat') {
        const heartbeat = await redis.get(`slave:${instanceName}:heartbeat`);
        if (heartbeat === null) continue;
        instancePartials[instanceName].updatedMillisecond = Number(heartbeat);
      } else if (type === 'install-ids') {
        const installIdsJson = await redis.get(
          `slave:${instanceName}:install-ids`
        );
        if (installIdsJson === null) continue;
        instancePartials[instanceName].installIds = JSON.parse(
          installIdsJson
        ) as string[];
      } else {
        continue;
      }
    }
    const instances: {
      [instanceName: string]: WorkerInstance;
    } = {};
    for (const [name, instance] of Object.entries(instancePartials)) {
      instances[name] = {
        name,
        installIds: instance.installIds ?? [],
        updatedMillisecond: instance.updatedMillisecond ?? 0,
      };
    }
    return instances;
  }

  public async addWorkerInstance(
    instanceName: string,
    props: WorkerProperties
  ): Promise<WorkerInstance> {
    const redis = this._redisAdaptor.getRedisInstance();
    // TODO: 既にある場合はリセット
    // ハートビートがあるか確認
    const heartbeat = await redis.get(`slave:${instanceName}:heartbeat`);
    if (!heartbeat) throw new Error('Instance not found');
    const res = await redis.set(
      `slave:${instanceName}:install-ids`,
      JSON.stringify(props.installIds)
    );
    if (res !== 'OK') throw new Error('Failed to add worker data.');
    return {
      name: instanceName,
      installIds: props.installIds,
      updatedMillisecond: Number(heartbeat),
    };
  }

  public async updateWorkerInstance(
    instanceName: string,
    props: Partial<WorkerProperties>
  ): Promise<WorkerInstance> {
    const redis = this._redisAdaptor.getRedisInstance();
    const instance = await this.getWorkerInstance(instanceName);
    if (!instance) throw new Error('Instance not found');
    if (props.installIds) {
      const res = await redis.set(
        `slave:${instanceName}:install-ids`,
        JSON.stringify(props.installIds)
      );
      if (res !== 'OK') throw new Error('Failed to add worker data.');
    }
    const current = await this.getWorkerInstance(instanceName);
    if (!current) throw new Error('Instance not found');
    return {
      name: instanceName,
      installIds: current.installIds,
      updatedMillisecond: current.updatedMillisecond,
    };
  }

  public async deleteWorkerInstance(instanceName: string): Promise<void> {
    // installIds を削除
    const redis = this._redisAdaptor.getRedisInstance();
    const res1 = await redis.del(`slave:${instanceName}:heartbeat`);
    const res2 = await redis.del(`slave:${instanceName}:install-ids`);
    if (res1 > 1) {
      logger.warn(
        `Invalid data detected on ${instanceName}: heartbeat delete operation returned ${res1}`
      );
    }
    if (res2 !== 1) {
      logger.warn(
        `Invalid data detected on ${instanceName}: ids delete operation returned ${res2}`
      );
    }
  }
}
