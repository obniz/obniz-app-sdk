"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisInstallStore = void 0;
const logger_1 = require("../logger");
const InstallStoreBase_1 = require("./InstallStoreBase");
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
class RedisInstallStore extends InstallStoreBase_1.InstallStoreBase {
    constructor(adaptor) {
        super();
        this._redisAdaptor = adaptor;
    }
    async get(id) {
        var e_1, _a;
        const redis = this._redisAdaptor.getRedisInstance();
        const workerKeys = await redis.keys('workers:*');
        let install;
        try {
            for (var workerKeys_1 = __asyncValues(workerKeys), workerKeys_1_1; workerKeys_1_1 = await workerKeys_1.next(), !workerKeys_1_1.done;) {
                const key = workerKeys_1_1.value;
                const ins = await redis.hget(key, id);
                if (ins)
                    install = JSON.parse(ins);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (workerKeys_1_1 && !workerKeys_1_1.done && (_a = workerKeys_1.return)) await _a.call(workerKeys_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return install;
    }
    async getMany(ids) {
        var e_2, _a;
        const redis = this._redisAdaptor.getRedisInstance();
        const workerKeys = await redis.keys('workers:*');
        const installs = {};
        for (const id of ids) {
            try {
                for (var workerKeys_2 = (e_2 = void 0, __asyncValues(workerKeys)), workerKeys_2_1; workerKeys_2_1 = await workerKeys_2.next(), !workerKeys_2_1.done;) {
                    const key = workerKeys_2_1.value;
                    const ins = await redis.hget(key, id);
                    if (ins)
                        installs[id] = JSON.parse(ins);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (workerKeys_2_1 && !workerKeys_2_1.done && (_a = workerKeys_2.return)) await _a.call(workerKeys_2);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        return installs;
    }
    async getByWorker(name) {
        const redis = this._redisAdaptor.getRedisInstance();
        const rawInstalls = await redis.hgetall(`workers:${name}`);
        const installs = {};
        for (const obnizId in rawInstalls) {
            installs[obnizId] = JSON.parse(rawInstalls[obnizId]);
        }
        return installs;
    }
    async getAll() {
        var e_3, _a;
        var _b;
        const redis = this._redisAdaptor.getRedisInstance();
        // Search where
        const workerKeys = await redis.keys('workers:*');
        const installs = {};
        try {
            for (var workerKeys_3 = __asyncValues(workerKeys), workerKeys_3_1; workerKeys_3_1 = await workerKeys_3.next(), !workerKeys_3_1.done;) {
                const key = workerKeys_3_1.value;
                const workerNameMatch = key.match(/workers:(?<name>.+)/);
                if (workerNameMatch === null ||
                    ((_b = workerNameMatch.groups) === null || _b === void 0 ? void 0 : _b.name) === undefined)
                    continue;
                const workerName = workerNameMatch.groups.name;
                const workers = await this.getByWorker(workerName);
                Object.assign(installs, workers);
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (workerKeys_3_1 && !workerKeys_3_1.done && (_a = workerKeys_3.return)) await _a.call(workerKeys_3);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return installs;
    }
    async autoCreate(id, device) {
        const redis = this._redisAdaptor.getRedisInstance();
        try {
            const res = await redis.eval(AutoCreateLuaScript, 1, id, JSON.stringify({ install: device }));
            return JSON.parse(res);
        }
        catch (e) {
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
    async manualCreate(id, install) {
        const redis = this._redisAdaptor.getRedisInstance();
        // setnx
        const resSetNx = await redis.hsetnx(`workers:${install.instanceName}`, id, JSON.stringify(install));
        if (resSetNx === 1) {
            // Created
            return install;
        }
        else {
            // Already created
            throw new Error(`${id} already created`);
        }
    }
    async autoRelocate(id, force = false) {
        const redis = this._redisAdaptor.getRedisInstance();
        try {
            const res = await redis.eval(AutoRelocateLuaScript, 1, id, force ? 'true' : 'false');
            return JSON.parse(res);
        }
        catch (e) {
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
    async update(id, props) {
        const redis = this._redisAdaptor.getRedisInstance();
        try {
            const res = await redis.eval(UpdateInstallLuaScript, 1, id, JSON.stringify(props));
            return JSON.parse(res);
        }
        catch (e) {
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
    async remove(id) {
        const install = await this.get(id);
        if (install) {
            const redis = this._redisAdaptor.getRedisInstance();
            const res = await redis.hdel(`workers:${install.instanceName}`, id);
            if (res !== 1) {
                logger_1.logger.warn(`Invalid data detected (RemoveInstall:${id}) : deleted count is not 1`);
            }
        }
        else {
            logger_1.logger.warn(`failed remove: ${id} not found`);
        }
    }
    async doAllRelocate() {
        const redis = this._redisAdaptor.getRedisInstance();
        try {
            const res = await redis.eval(AllRelocateLuaScript, 0);
        }
        catch (e) {
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
exports.RedisInstallStore = RedisInstallStore;
//# sourceMappingURL=RedisInstallStore.js.map