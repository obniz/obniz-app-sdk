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
class RedisInstallStore extends InstallStoreBase_1.InstallStoreBase {
    constructor(adaptor) {
        super();
        this._redisAdaptor = adaptor;
    }
    async get(id) {
        var e_1, _a;
        const redis = this._redisAdaptor.getRedisInstance();
        // Search where
        const workerKeys = await redis.keys('workers:*');
        let install;
        try {
            for (var workerKeys_1 = __asyncValues(workerKeys), workerKeys_1_1; workerKeys_1_1 = await workerKeys_1.next(), !workerKeys_1_1.done;) {
                const key = workerKeys_1_1.value;
                // check keys exist
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
        var e_2, _a;
        var _b;
        const redis = this._redisAdaptor.getRedisInstance();
        // Search where
        const workerKeys = await redis.keys('workers:*');
        const installs = {};
        try {
            for (var workerKeys_2 = __asyncValues(workerKeys), workerKeys_2_1; workerKeys_2_1 = await workerKeys_2.next(), !workerKeys_2_1.done;) {
                const key = workerKeys_2_1.value;
                const workerNameMatch = key.match(/workers:(?<name>.+)/);
                if (workerNameMatch === null ||
                    ((_b = workerNameMatch.groups) === null || _b === void 0 ? void 0 : _b.name) === undefined)
                    continue;
                const workerName = workerNameMatch.groups.name;
                const workers = await this.getByWorker(workerName);
                Object.assign(installs, workers);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (workerKeys_2_1 && !workerKeys_2_1.done && (_a = workerKeys_2.return)) await _a.call(workerKeys_2);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return installs;
    }
    async autoCreate(id, device) {
        const redis = this._redisAdaptor.getRedisInstance();
        // TODO: error handling
        try {
            const res = await redis.eval(AutoCreateLuaScript, 1, id, JSON.stringify({ install: device }));
            return JSON.parse(res);
        }
        catch (e) {
            logger_1.logger.info(e);
        }
        return null;
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
        // TODO: error handling
        try {
            const res = await redis.eval(AutoRelocateLuaScript, 1, id, force ? 'true' : 'false');
            return JSON.parse(res);
        }
        catch (e) {
            logger_1.logger.info(e);
        }
        return null;
    }
    async update(id, props) {
        var _a, _b, _c, _d;
        const redis = this._redisAdaptor.getRedisInstance();
        const nowInstall = await this.get(id);
        if (!nowInstall) {
            throw new Error(`${id} not found`);
        }
        else {
            const newInstall = {
                install: (_a = props.install) !== null && _a !== void 0 ? _a : nowInstall.install,
                instanceName: (_b = props.instanceName) !== null && _b !== void 0 ? _b : nowInstall.instanceName,
                status: (_c = props.status) !== null && _c !== void 0 ? _c : nowInstall.status,
                updatedMillisecond: (_d = props.updatedMillisecond) !== null && _d !== void 0 ? _d : nowInstall.updatedMillisecond,
            };
            if (props.instanceName !== undefined) {
                // delete nowInstall
                await this.remove(id);
            }
            const res = await redis.hset(`workers:${newInstall.instanceName}`, id, JSON.stringify(newInstall));
            // Note: HSET should be return number
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (res === 0) {
                return newInstall;
            }
            throw new Error(`failed update: ${id} operation returned ${res}`);
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
}
exports.RedisInstallStore = RedisInstallStore;
//# sourceMappingURL=RedisInstallStore.js.map