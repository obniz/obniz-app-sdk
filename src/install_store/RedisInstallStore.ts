import { Installed_Device } from 'obniz-cloud-sdk/sdk';
import { RedisAdaptor } from '../adaptor/RedisAdaptor';
import { logger } from '../logger';
import { InstallStoreBase, ManagedInstall } from './InstallStoreBase';

const AutoCreateLuaScript = `local runningWorkerKeys = redis.call('KEYS', 'slave:*:heartbeat')
local assignedWorkerKeys = redis.call('KEYS', 'workers:*')
if #runningWorkerKeys == 0 then return {err='NO_ACCEPTABLE_WORKER'} end
for i = 1 , #assignedWorkerKeys do
  local exist = redis.call('HEXISTS', assignedWorkerKeys[i], KEYS[1])
  if exist == 1 then return {err='ALREADY_INSTALLED'} end
end
local minWorkerName
local minCount
for i = 1 , #runningWorkerKeys do
  local workerName = string.match(runningWorkerKeys[i], "slave:(.+):heartbeat")
  local count = redis.call('HLEN', 'workers:'..workerName)
  if minCount == nil or minCount >= count then
    minWorkerName = workerName
    minCount = count
  end
end
local obj = cjson.decode(ARGV[1])
local timeres = redis.call('TIME')
local timestamp = timeres[1]
obj['status'] = 0
obj['instanceName'] = minWorkerName
obj['updatedMillisecond'] = timestamp
local json = cjson.encode(obj)
local setres = redis.call('HSET', 'workers:'..minWorkerName, KEYS[1], json)
local result = redis.call('HGET', 'workers:'..minWorkerName, KEYS[1])
return { result }`;

const AutoRelocateLuaScript = `local runningWorkerKeys = redis.call('KEYS', 'slave:*:heartbeat')
local assignedWorkerKeys = redis.call('KEYS', 'workers:*')
if #runningWorkerKeys == 0 then return {err='NO_ACCEPTABLE_WORKER'} end
local nowWorkerName
for i = 1 , #assignedWorkerKeys do
  local exist = redis.call('HEXISTS', assignedWorkerKeys[i], ARGV[1])
  if exist == 1 then
    nowWorkerName = string.match(assignedWorkerKeys[i], "workers:(.+)")
    break
  end
end
if nowWorkerName == nil then return {err='NOT_INSTALLED'} end
local minWorkerName
local minCount
for i = 1 , #runningWorkerKeys do
  local workerName = string.match(runningWorkerKeys[i], "slave:(.+):heartbeat")
  if not(workerName == nowWorkerName) then
    local count = redis.call('HLEN', 'workers:'..workerName)
    if minCount == nil or minCount >= count then
      minWorkerName = workerName
      minCount = count
    end
  end
end
if minWorkerName == nil then return {err='NO_OTHER_ACCEPTABLE_WORKER'} end
local nowObj = cjson.decode(redis.call('HGET', 'workers:'..nowWorkerName, ARGV[1]))
local newObj = nowObj
local timeres = redis.call('TIME')
local timestamp = timeres[1]
newObj['status'] = 0
newObj['instanceName'] = minWorkerName
newObj['updatedMillisecond'] = timestamp
local json = cjson.encode(newObj)
local setres = redis.call('HSET', 'workers:'..minWorkerName, ARGV[1], json)
local result = redis.call('HGET', 'workers:'..minWorkerName, ARGV[1])
local delres = redis.call('HDEL', 'workers:'..nowWorkerName, ARGV[1])
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
      const ins = await redis.hget(key, id);
      if (ins) install = JSON.parse(ins) as ManagedInstall;
    }
    return install;
  }

  public async getByWorker(
    name: string
  ): Promise<{ [id: string]: ManagedInstall }> {
    const redis = this._redisAdaptor.getRedisInstance();
    const rawInstalls = await redis.hgetall(`workers:${name}`);
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
      const workerNameMatch = key.match(/workers:(?<name>.+)/);
      if (
        workerNameMatch === null ||
        workerNameMatch.groups?.name === undefined
      )
        continue;
      const workerName = workerNameMatch.groups.name;
      const workers = await this.getByWorker(workerName);
      Object.assign(installs, workers);
    }
    return installs;
  }

  public async autoCreate(
    id: string,
    device: Installed_Device
  ): Promise<ManagedInstall> {
    const redis = this._redisAdaptor.getRedisInstance();
    // TODO: error handling
    const res = await redis.eval(
      AutoCreateLuaScript,
      1,
      id,
      JSON.stringify({ install: device })
    );
    return JSON.parse(res) as ManagedInstall;
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
    // TODO: error handling
    const res = await redis.eval(AutoRelocateLuaScript, 0, id);
    return JSON.parse(res) as ManagedInstall;
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
      // Note: HSET should be return number
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (res === 0) {
        return newInstall;
      }
      throw new Error(`failed update: ${id} operation returned ${res}`);
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
