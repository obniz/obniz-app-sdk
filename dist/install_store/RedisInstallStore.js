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
                const ins = await redis.hget(`workers:${key}`, id);
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
        const rawInstalls = await redis.hgetall(`worker:${name}`);
        const installs = {};
        for (const obnizId in rawInstalls) {
            installs[obnizId] = JSON.parse(rawInstalls[obnizId]);
        }
        return installs;
    }
    async getAll() {
        var e_2, _a;
        const redis = this._redisAdaptor.getRedisInstance();
        // Search where
        const workerKeys = await redis.keys('workers:*');
        const installs = {};
        try {
            for (var workerKeys_2 = __asyncValues(workerKeys), workerKeys_2_1; workerKeys_2_1 = await workerKeys_2.next(), !workerKeys_2_1.done;) {
                const key = workerKeys_2_1.value;
                const workers = await this.getByWorker(key);
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
        const res = await redis.eval(AutoCreateLuaScript, 1, id, JSON.stringify({ install: device }));
        console.log(res);
        const data = await this.get('id');
        if (!data)
            throw new Error('unexpected');
        return data;
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
    async autoRelocate(id) {
        const redis = this._redisAdaptor.getRedisInstance();
        throw new Error('not implemented');
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
            if (res === 'OK') {
                return newInstall;
            }
            throw new Error(`failed update: ${id}`);
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