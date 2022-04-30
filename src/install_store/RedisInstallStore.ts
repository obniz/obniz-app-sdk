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

const AllRelocateLuaScript = `
local function hasKey(keys, key)
  for i = 1, #keys do
    if (keys[i] == key) then return true end
  end
  return false
end
local runningWorkerKeys = redis.call('KEYS', 'slave:*:heartbeat')
local assignedWorkerKeys = redis.call('KEYS', 'workers:*');
if #runningWorkerKeys == 0 then return {err='NO_WORKER'} end
local assignedCounts = {}
local totalCount = 0
for i = 1, #runningWorkerKeys do
  local key = string.match(runningWorkerKeys[i], "slave:(.+):heartbeat")
  if hasKey(assignedWorkerKeys, 'workers:'..key) then
    local count = redis.call('HLEN', 'workers:'..key)
    table.insert(assignedCounts, {key=key,count=count})
    totalCount = totalCount + count
  else
    table.insert(assignedCounts, {key=key,count=0})
  end
end
local minCountCond = math.floor(totalCount / #assignedCounts)
for j = 1, #assignedCounts do
  table.sort(assignedCounts, function (a, b)
    return a.count > b.count
  end)
  local max = assignedCounts[1]
  local min = assignedCounts[#assignedCounts]
  if min.count == minCountCond then break end
  local movCount = math.min(math.floor((max.count - min.count) / 2), minCountCond)
  local movWorkers = redis.call('HGETALL', 'workers:'..max.key)
  for i = 1, movCount * 2, 2 do
    local nowObj = cjson.decode(movWorkers[i + 1])
    local newObj = nowObj
    local timestamp = redis.call('TIME')[1]
    newObj['instanceName'] = min.key
    newObj['updatedMillisecond'] = timestamp
    local json = cjson.encode(newObj)
    local setres = redis.call('HSET', 'workers:'..min.key, movWorkers[i], json)
    local delres = redis.call('HDEL', 'workers:'..max.key, movWorkers[i])
  end
  assignedCounts[1] = {key=assignedCounts[1].key, count=assignedCounts[1].count - movCount}
  assignedCounts[#assignedCounts] = {key=assignedCounts[#assignedCounts].key, count=assignedCounts[#assignedCounts].count + movCount}
end
`;

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
        UpdateInstallLuaScript,
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

  public async doAllRelocate(): Promise<void> {
    const redis = this._redisAdaptor.getRedisInstance();
    try {
      const res = await redis.eval(AllRelocateLuaScript, 0);
    } catch (e) {
      if (e instanceof Error) {
        switch (e.message) {
          case 'NO_WORKER':
            throw new Error(e.message);
          default:
            throw e;
        }
      }
      throw e;
    }
  }
}
