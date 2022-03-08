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
  local exist = redis.call('HEXISTS', assignedWorkerKeys[i], KEYS[1])
  if exist == 1 then
    nowWorkerName = string.match(assignedWorkerKeys[i], "workers:(.+)")
    break
  end
end
if nowWorkerName == nil then return {err='NOT_INSTALLED'} end
if ARGV[1] == 'false' then
  local isNowWorkerRunning = redis.call('EXISTS', 'slave:'..nowWorkerName..':heartbeat')
  if not(isNowWorkerRunning == 0) then return {err='NO_NEED_TO_RELOCATE'} end
end
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
local nowObj = cjson.decode(redis.call('HGET', 'workers:'..nowWorkerName, KEYS[1]))
local newObj = nowObj
local timeres = redis.call('TIME')
local timestamp = timeres[1]
newObj['status'] = 0
newObj['instanceName'] = minWorkerName
newObj['updatedMillisecond'] = timestamp
local json = cjson.encode(newObj)
local setres = redis.call('HSET', 'workers:'..minWorkerName, KEYS[1], json)
local result = redis.call('HGET', 'workers:'..minWorkerName, KEYS[1])
local delres = redis.call('HDEL', 'workers:'..nowWorkerName, KEYS[1])
return { result }`;

const UpdateInstallLuaScript = `local runningWorkerKeys = redis.call('KEYS', 'slave:*:heartbeat')
local assignedWorkerKeys = redis.call('KEYS', 'workers:*')
if #runningWorkerKeys == 0 then return {err='NO_RUNNING_WORKER'} end
local nowWorkerName
for i = 1 , #assignedWorkerKeys do
  local exist = redis.call('HEXISTS', assignedWorkerKeys[i], KEYS[1])
  if exist == 1 then
    nowWorkerName = string.match(assignedWorkerKeys[i], "workers:(.+)")
    break
  end
end
if nowWorkerName == nil then return {err='NOT_INSTALLED'} end
local nowObj = cjson.decode(redis.call('HGET', 'workers:'..nowWorkerName, KEYS[1]))
local overrideObj = cjson.decode(ARGV[1])
local newObj = nowObj
for k,v in pairs(overrideObj) do newObj[k] = v end
local json = cjson.encode(newObj)
local setres = redis.call('HSET', 'workers:'..nowWorkerName, KEYS[1], json)
local result = redis.call('HGET', 'workers:'..nowWorkerName, KEYS[1])
return { result }`;

export class RedisInstallStore extends InstallStoreBase {
  private _redisAdaptor: RedisAdaptor;

  constructor(adaptor: RedisAdaptor) {
    super();
    this._redisAdaptor = adaptor;
  }

  public async get(id: string): Promise<ManagedInstall | undefined> {
    const redis = this._redisAdaptor.getRedisInstance();
    const workerKeys = await redis.keys('workers:*');
    let install: ManagedInstall | undefined;
    for await (const key of workerKeys) {
      const ins = await redis.hget(key, id);
      if (ins) install = JSON.parse(ins) as ManagedInstall;
    }
    return install;
  }

  public async getMany(
    ids: string[]
  ): Promise<{ [id: string]: ManagedInstall | undefined }> {
    const redis = this._redisAdaptor.getRedisInstance();
    const workerKeys = await redis.keys('workers:*');
    const installs: { [id: string]: ManagedInstall | undefined } = {};
    for (const id of ids) {
      for await (const key of workerKeys) {
        const ins = await redis.hget(key, id);
        if (ins) installs[id] = JSON.parse(ins) as ManagedInstall;
      }
    }
    return installs;
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
    try {
      const res = await redis.eval(
        AutoCreateLuaScript,
        1,
        id,
        JSON.stringify({ install: device })
      );
      return JSON.parse(res) as ManagedInstall;
    } catch (e) {
      if (e instanceof Error) {
        switch (e.message) {
          case 'NO_ACCEPTABLE_WORKER':
          case 'ALREADY_INSTALLED':
            throw new Error(e.message);
          default:
            throw e;
        }
      }
      throw e;
    }
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

  public async autoRelocate(
    id: string,
    force = false
  ): Promise<ManagedInstall> {
    const redis = this._redisAdaptor.getRedisInstance();
    try {
      const res = await redis.eval(
        AutoRelocateLuaScript,
        1,
        id,
        force ? 'true' : 'false'
      );
      return JSON.parse(res) as ManagedInstall;
    } catch (e) {
      if (e instanceof Error) {
        switch (e.message) {
          case 'NO_ACCEPTABLE_WORKER':
          case 'NOT_INSTALLED':
          case 'NO_OTHER_ACCEPTABLE_WORKER':
          case 'NO_NEED_TO_RELOCATE':
            throw new Error(e.message);
          default:
            throw e;
        }
      }
      throw e;
    }
  }

  public async update(
    id: string,
    props: Partial<ManagedInstall>
  ): Promise<ManagedInstall> {
    const redis = this._redisAdaptor.getRedisInstance();
    try {
      const res = await redis.eval(
        AutoRelocateLuaScript,
        1,
        id,
        JSON.stringify(props)
      );
      return JSON.parse(res) as ManagedInstall;
    } catch (e) {
      if (e instanceof Error) {
        switch (e.message) {
          case 'NO_RUNNING_WORKER':
          case 'NOT_INSTALLED':
            throw new Error(e.message);
          default:
            throw e;
        }
      }
      throw e;
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
