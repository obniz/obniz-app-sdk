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
        const installIds = await redis.hkeys(`workers:${instanceName}`);
        if (heartbeat === null && installIds === null)
            return undefined;
        return {
            name: instanceName,
            installIds: installIds !== null && installIds !== void 0 ? installIds : [],
            updatedMillisecond: heartbeat === null ? Number(heartbeat) : 1,
        };
    }
    async getAllWorkerInstances() {
        var e_1, _a, e_2, _b;
        var _c, _d, _e, _f;
        const redis = this._redisAdaptor.getRedisInstance();
        // FIXME: Using keys
        const workingKeys = await redis.keys('slave:*:heartbeat');
        const assignedKeys = await redis.keys('workers:*');
        const instancePartials = {};
        try {
            for (var workingKeys_1 = __asyncValues(workingKeys), workingKeys_1_1; workingKeys_1_1 = await workingKeys_1.next(), !workingKeys_1_1.done;) {
                const workingKey = workingKeys_1_1.value;
                const match = workingKey.match(/slave:(?<name>.+):heartbeat/);
                if (match === null || ((_c = match.groups) === null || _c === void 0 ? void 0 : _c.name) === undefined)
                    continue;
                const workerName = match.groups.name;
                if (instancePartials[workerName] === undefined)
                    instancePartials[workerName] = {};
                const heartbeat = await redis.get(`slave:${workerName}:heartbeat`);
                if (heartbeat === null)
                    continue;
                instancePartials[workerName].updatedMillisecond = Number(heartbeat);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (workingKeys_1_1 && !workingKeys_1_1.done && (_a = workingKeys_1.return)) await _a.call(workingKeys_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        try {
            for (var assignedKeys_1 = __asyncValues(assignedKeys), assignedKeys_1_1; assignedKeys_1_1 = await assignedKeys_1.next(), !assignedKeys_1_1.done;) {
                const assignKey = assignedKeys_1_1.value;
                const match = assignKey.match(/workers:(?<name>.+)/);
                if (match === null || ((_d = match.groups) === null || _d === void 0 ? void 0 : _d.name) === undefined)
                    continue;
                const workerName = match.groups.name;
                if (instancePartials[workerName] === undefined)
                    instancePartials[workerName] = {};
                instancePartials[workerName].installIds = await redis.hkeys(`workers:${workerName}`);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (assignedKeys_1_1 && !assignedKeys_1_1.done && (_b = assignedKeys_1.return)) await _b.call(assignedKeys_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        const instances = {};
        for (const [name, instance] of Object.entries(instancePartials)) {
            instances[name] = {
                name,
                installIds: (_e = instance.installIds) !== null && _e !== void 0 ? _e : [],
                updatedMillisecond: (_f = instance.updatedMillisecond) !== null && _f !== void 0 ? _f : 0,
            };
        }
        return instances;
    }
    async addWorkerInstance(instanceName, props) {
        const redis = this._redisAdaptor.getRedisInstance();
        // ハートビートがあるか確認
        const heartbeat = await redis.get(`slave:${instanceName}:heartbeat`);
        if (!heartbeat)
            throw new Error('Instance not found');
        return {
            name: instanceName,
            installIds: props.installIds,
            updatedMillisecond: Number(heartbeat),
        };
    }
    async updateWorkerInstance(instanceName, props) {
        var _a, _b;
        const redis = this._redisAdaptor.getRedisInstance();
        const instance = await this.getWorkerInstance(instanceName);
        if (!instance)
            throw new Error('Instance not found');
        const exist = await redis.exists(`slave:${instanceName}:install-ids`);
        if (exist === 0) {
            return await this.addWorkerInstance(instanceName, {
                installIds: (_a = props.installIds) !== null && _a !== void 0 ? _a : [],
                updatedMillisecond: (_b = props.updatedMillisecond) !== null && _b !== void 0 ? _b : 0,
            });
        }
        else {
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
    }
    async deleteWorkerInstance(instanceName) {
        // installIds を削除
        const redis = this._redisAdaptor.getRedisInstance();
        const res1 = await redis.del(`slave:${instanceName}:heartbeat`);
        const res2 = await redis.del(`workers:${instanceName}`);
        if (res1 > 1) {
            logger_1.logger.warn(`Invalid data detected on ${instanceName}: heartbeat delete operation returned ${res1}`);
        }
        if (res2 > 1) {
            logger_1.logger.warn(`Invalid data detected on ${instanceName}: workers delete operation returned ${res2}`);
        }
    }
}
exports.RedisWorkerStore = RedisWorkerStore;
//# sourceMappingURL=RedisWorkerStore.js.map