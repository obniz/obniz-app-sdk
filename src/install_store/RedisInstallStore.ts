import { Installed_Device } from 'obniz-cloud-sdk/sdk';
import { RedisAdaptor } from '../adaptor/RedisAdaptor';
import { logger } from '../logger';
import { InstallStoreBase, ManagedInstall } from './InstallStoreBase';

const AutoCreateLuaScript = `-- get slaves
local workerKeys = redis.call('KEYS', 'workers:*')
if #workerKeys == 0 then return {err='worker not found'} end
-- check exist
for i = 1 , #workerKeys do
  -- note: this will not work on redis cluster
  local exist = redis.call('HEXISTS', workerKeys[i], KEYS[1])
  if exist == 1 then return {err='already installed'} end
end
-- get counts and check min
local minKey = workerKeys[1]
local minCount
for i = 1 , #workerKeys do
  local count = redis.call('HLEN', workerKeys[i])
  if minCount == nil then
    minCount = count
  end
  if minCount >= count then
    minKey = workerKeys[i]
    minCount = count
  end
end
-- add
local instName = string.match(minKey, "workers:(.+)")
local obj = cjson.decode(ARGV[1])
obj['instanceName'] = instName
local json = cjson.encode(obj)
local setres = redis.call('HSET', minKey, KEYS[1], json)
local result = redis.call('HGET', minKey, KEYS[1])
return { result }`;

export class RedisInstallStore extends InstallStoreBase {
  private _redisAdaptor: RedisAdaptor;

  constructor(adaptor: RedisAdaptor) {
    super();
    this._redisAdaptor = adaptor;
  }

  public async get(id: string): Promise<ManagedInstall | undefined> {
    const redis = this._redisAdaptor.getRedisInstance();
    // Search where
    const workerKeys = await redis.keys('workers:*');
    let install: ManagedInstall | undefined;
    for await (const key of workerKeys) {
      // check keys exist
      const ins = await redis.hget(`workers:${key}`, id);
      if (ins) install = JSON.parse(ins) as ManagedInstall;
    }
    return install;
  }

  public async getByWorker(
    name: string
  ): Promise<{ [id: string]: ManagedInstall }> {
    const redis = this._redisAdaptor.getRedisInstance();
    const rawInstalls = await redis.hgetall(`worker:${name}`);
    const installs: { [id: string]: ManagedInstall } = {};
    for (const obnizId in rawInstalls) {
      installs[obnizId] = JSON.parse(rawInstalls[obnizId]) as ManagedInstall;
    }
    return installs;
  }

  public async getAll(): Promise<{ [id: string]: ManagedInstall }> {
    const redis = this._redisAdaptor.getRedisInstance();
    // Search where
    const workerKeys = await redis.keys('workers:*');
    const installs: { [id: string]: ManagedInstall } = {};
    for await (const key of workerKeys) {
      const workers = await this.getByWorker(key);
      Object.assign(installs, workers);
    }
    return installs;
  }

  public async autoCreate(
    id: string,
    device: Installed_Device
  ): Promise<ManagedInstall> {
    const redis = this._redisAdaptor.getRedisInstance();
    const res = await redis.eval(
      AutoCreateLuaScript,
      1,
      id,
      JSON.stringify({ install: device })
    );
    console.log(res);
    const data = await this.get('id');
    if (!data) throw new Error('unexpected');
    return data;
  }

  public async manualCreate(
    id: string,
    install: ManagedInstall
  ): Promise<ManagedInstall> {
    const redis = this._redisAdaptor.getRedisInstance();
    // setnx
    const resSetNx = await redis.hsetnx(
      `workers:${install.instanceName}`,
      id,
      JSON.stringify(install)
    );
    if (resSetNx === 1) {
      // Created
      return install;
    } else {
      // Already created
      throw new Error(`${id} already created`);
    }
  }

  public async autoRelocate(id: string): Promise<ManagedInstall> {
    const redis = this._redisAdaptor.getRedisInstance();
    throw new Error('not implemented');
  }

  public async update(
    id: string,
    props: Partial<ManagedInstall>
  ): Promise<ManagedInstall> {
    const redis = this._redisAdaptor.getRedisInstance();
    const nowInstall = await this.get(id);
    if (!nowInstall) {
      throw new Error(`${id} not found`);
    } else {
      const newInstall = {
        install: props.install ?? nowInstall.install,
        instanceName: props.instanceName ?? nowInstall.instanceName,
        status: props.status ?? nowInstall.status,
        updatedMillisecond:
          props.updatedMillisecond ?? nowInstall.updatedMillisecond,
      };
      if (props.instanceName !== undefined) {
        // delete nowInstall
        await this.remove(id);
      }
      const res = await redis.hset(
        `workers:${newInstall.instanceName}`,
        id,
        JSON.stringify(newInstall)
      );
      if (res === 'OK') {
        return newInstall;
      }
      throw new Error(`failed update: ${id}`);
    }
  }

  public async remove(id: string): Promise<void> {
    const install = await this.get(id);
    if (install) {
      const redis = this._redisAdaptor.getRedisInstance();
      const res = await redis.hdel(`workers:${install.instanceName}`, id);
      if (res !== 1) {
        logger.warn(
          `Invalid data detected (RemoveInstall:${id}) : deleted count is not 1`
        );
      }
    } else {
      logger.warn(`failed remove: ${id} not found`);
    }
  }
}
