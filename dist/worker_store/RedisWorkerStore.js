"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisWorkerStore = void 0;
const logger_1 = require("../logger");
const WorkerStoreBase_1 = require("./WorkerStoreBase");
class RedisWorkerStore extends WorkerStoreBase_1.WorkerStoreBase {
    constructor(adaptor) {
        super();
        this._redisAdaptor = adaptor;
    }
    async getWorkerInstance(instanceName) {
        const redis = this._redisAdaptor.getRedisInstance();
        const heartbeat = await redis.get(`slave:${instanceName}:heartbeat`);
        const installIdsJson = await redis.get(`slave:${instanceName}:install-ids`);
        if (heartbeat === null && installIdsJson === null)
            return undefined;
        return {
            name: instanceName,
            installIds: installIdsJson === null ? [] : JSON.parse(installIdsJson),
            updatedMillisecond: heartbeat === null ? Number(heartbeat) : 1,
        };
    }
    async getAllWorkerInstances() {
        var e_1, _a;
        var _b, _c, _d, _e;
        const redis = this._redisAdaptor.getRedisInstance();
        // FIXME: Using keys
        const keys = await redis.keys('slave:*');
        const instancePartials = {};
        try {
            for (var keys_1 = __asyncValues(keys), keys_1_1; keys_1_1 = await keys_1.next(), !keys_1_1.done;) {
                const key = keys_1_1.value;
                const match = key.match(/slave:(?<name>.*):(?<type>.*)/);
                if (match === null ||
                    ((_b = match.groups) === null || _b === void 0 ? void 0 : _b.name) === undefined ||
                    ((_c = match.groups) === null || _c === void 0 ? void 0 : _c.type) === undefined) {
                    continue;
                }
                const instanceName = match.groups.name;
                const type = match.groups.type;
                if (instancePartials[instanceName] === undefined)
                    instancePartials[instanceName] = {};
                if (type === 'heartbeat') {
                    const heartbeat = await redis.get(`slave:${instanceName}:heartbeat`);
                    if (heartbeat === null)
                        continue;
                    instancePartials[instanceName].updatedMillisecond = Number(heartbeat);
                }
                else if (type === 'install-ids') {
                    const installIdsJson = await redis.get(`slave:${instanceName}:install-ids`);
                    if (installIdsJson === null)
                        continue;
                    instancePartials[instanceName].installIds = JSON.parse(installIdsJson);
                }
                else {
                    continue;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (keys_1_1 && !keys_1_1.done && (_a = keys_1.return)) await _a.call(keys_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        const instances = {};
        for (const [name, instance] of Object.entries(instancePartials)) {
            instances[name] = {
                name,
                installIds: (_d = instance.installIds) !== null && _d !== void 0 ? _d : [],
                updatedMillisecond: (_e = instance.updatedMillisecond) !== null && _e !== void 0 ? _e : 0,
            };
        }
        return instances;
    }
    async addWorkerInstance(instanceName, props) {
        const redis = this._redisAdaptor.getRedisInstance();
        // TODO: 既にある場合はリセット
        // ハートビートがあるか確認
        const heartbeat = await redis.get(`slave:${instanceName}:heartbeat`);
        if (!heartbeat)
            throw new Error('Instance not found');
        const res = await redis.set(`slave:${instanceName}:install-ids`, JSON.stringify(props.installIds));
        if (res !== 'OK')
            throw new Error('Failed to add worker data.');
        return {
            name: instanceName,
            installIds: props.installIds,
            updatedMillisecond: Number(heartbeat),
        };
    }
    async updateWorkerInstance(instanceName, props) {
        const redis = this._redisAdaptor.getRedisInstance();
        const instance = await this.getWorkerInstance(instanceName);
        if (!instance)
            throw new Error('Instance not found');
        if (props.installIds) {
            const res = await redis.set(`slave:${instanceName}:install-ids`, JSON.stringify(props.installIds));
            if (res !== 'OK')
                throw new Error('Failed to add worker data.');
        }
        const current = await this.getWorkerInstance(instanceName);
        if (!current)
            throw new Error('Instance not found');
        return {
            name: instanceName,
            installIds: current.installIds,
            updatedMillisecond: current.updatedMillisecond,
        };
    }
    async deleteWorkerInstance(instanceName) {
        // installIds を削除
        const redis = this._redisAdaptor.getRedisInstance();
        const res1 = await redis.del(`slave:${instanceName}:heartbeat`);
        const res2 = await redis.del(`slave:${instanceName}:install-ids`);
        if (res1 > 1) {
            logger_1.logger.warn(`Invalid data detected on ${instanceName}: heartbeat delete operation returned ${res1}`);
        }
        if (res2 !== 1) {
            logger_1.logger.warn(`Invalid data detected on ${instanceName}: ids delete operation returned ${res2}`);
        }
    }
}
exports.RedisWorkerStore = RedisWorkerStore;
//# sourceMappingURL=RedisWorkerStore.js.map