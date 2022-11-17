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
        var _a, e_1, _b, _c, _d, e_2, _e, _f;
        var _g, _h, _j, _k;
        const redis = this._redisAdaptor.getRedisInstance();
        const workingKeys = await redis.keys('slave:*:heartbeat');
        const assignedKeys = await redis.keys('workers:*');
        const instancePartials = {};
        try {
            for (var _l = true, workingKeys_1 = __asyncValues(workingKeys), workingKeys_1_1; workingKeys_1_1 = await workingKeys_1.next(), _a = workingKeys_1_1.done, !_a;) {
                _c = workingKeys_1_1.value;
                _l = false;
                try {
                    const workingKey = _c;
                    const match = workingKey.match(/slave:(?<name>.+):heartbeat/);
                    if (match === null || ((_g = match.groups) === null || _g === void 0 ? void 0 : _g.name) === undefined)
                        continue;
                    const workerName = match.groups.name;
                    if (instancePartials[workerName] === undefined)
                        instancePartials[workerName] = {};
                    const heartbeat = await redis.get(`slave:${workerName}:heartbeat`);
                    if (heartbeat === null)
                        continue;
                    instancePartials[workerName].updatedMillisecond = Number(heartbeat);
                }
                finally {
                    _l = true;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_l && !_a && (_b = workingKeys_1.return)) await _b.call(workingKeys_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        try {
            for (var _m = true, assignedKeys_1 = __asyncValues(assignedKeys), assignedKeys_1_1; assignedKeys_1_1 = await assignedKeys_1.next(), _d = assignedKeys_1_1.done, !_d;) {
                _f = assignedKeys_1_1.value;
                _m = false;
                try {
                    const assignKey = _f;
                    const match = assignKey.match(/workers:(?<name>.+)/);
                    if (match === null || ((_h = match.groups) === null || _h === void 0 ? void 0 : _h.name) === undefined)
                        continue;
                    const workerName = match.groups.name;
                    if (instancePartials[workerName] === undefined)
                        instancePartials[workerName] = {};
                    instancePartials[workerName].installIds = await redis.hkeys(`workers:${workerName}`);
                }
                finally {
                    _m = true;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (!_m && !_d && (_e = assignedKeys_1.return)) await _e.call(assignedKeys_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        const instances = {};
        for (const name in instancePartials) {
            const instancePartial = instancePartials[name];
            instances[name] = {
                name,
                installIds: (_j = instancePartial.installIds) !== null && _j !== void 0 ? _j : [],
                updatedMillisecond: (_k = instancePartial.updatedMillisecond) !== null && _k !== void 0 ? _k : 0,
            };
        }
        return instances;
    }
    async deleteWorkerInstance(instanceName) {
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