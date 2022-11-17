"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Slave = void 0;
const logger_1 = require("./logger");
const RedisAdaptor_1 = require("./adaptor/RedisAdaptor");
const fast_equals_1 = require("fast-equals");
class Slave {
    constructor(_adaptor, _instanceName, _app) {
        this._adaptor = _adaptor;
        this._instanceName = _instanceName;
        this._app = _app;
        this._workers = {};
        this._interval = null;
        this._syncing = false;
        this.bindAdaptorCallbacks(_adaptor);
    }
    bindAdaptorCallbacks(adaptor) {
        this._adaptor.onSynchronize = async (options) => {
            await this._synchronize(options);
        };
        this._adaptor.onReportRequest = async (masterName) => {
            await this._reportToMaster(masterName);
        };
        this._adaptor.onKeyRequest = async (masterName, requestId, key, obnizId) => {
            await this._keyRequestProcess(masterName, requestId, key, obnizId);
        };
    }
    async _keyRequestProcess(masterName, requestId, key, obnizId) {
        if (obnizId !== undefined && this._workers[obnizId] === undefined) {
            await this._adaptor.keyRequestResponse(masterName, requestId, {});
            return;
        }
        const targetWorkers = obnizId === undefined
            ? this._workers
            : { [obnizId]: this._workers[obnizId] };
        const results = {};
        for (const install_id in targetWorkers) {
            results[install_id] = await this._workers[install_id].onRequest(key);
        }
        await this._adaptor.keyRequestResponse(masterName, requestId, results);
    }
    async _getInstallsFromRedis() {
        if (!(this._adaptor instanceof RedisAdaptor_1.RedisAdaptor)) {
            throw new Error('Cannot fetch installs from Redis because the instance is not connected to Redis.');
        }
        try {
            const redis = this._adaptor.getRedisInstance();
            const rawInstalls = await redis.hgetall(`workers:${this._app._options.instanceName}`);
            const installs = {};
            for (const obnizId in rawInstalls) {
                installs[obnizId] = JSON.parse(rawInstalls[obnizId]).install;
            }
            return installs;
        }
        catch (e) {
            logger_1.logger.error(e);
        }
        return {};
    }
    /**
     * Receive Master Generated List and compare current apps.
     */
    async _synchronize(options) {
        var _a, e_1, _b, _c, _d, e_2, _e, _f;
        if (this._syncing) {
            return;
        }
        this._syncing = true;
        const installs = options.syncType === 'list'
            ? options.installs
            : Object.values(await this._getInstallsFromRedis());
        try {
            const exists = {};
            for (const install_id in this._workers) {
                exists[install_id] = this._workers[install_id];
            }
            try {
                for (var _g = true, installs_1 = __asyncValues(installs), installs_1_1; installs_1_1 = await installs_1.next(), _a = installs_1_1.done, !_a;) {
                    _c = installs_1_1.value;
                    _g = false;
                    try {
                        const install = _c;
                        await this._startOrRestartOneWorker(install);
                        if (exists[install.id]) {
                            delete exists[install.id];
                        }
                    }
                    finally {
                        _g = true;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_g && !_a && (_b = installs_1.return)) await _b.call(installs_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            try {
                // Apps which not listed
                for (var _h = true, _j = __asyncValues(Object.keys(exists)), _k; _k = await _j.next(), _d = _k.done, !_d;) {
                    _f = _k.value;
                    _h = false;
                    try {
                        const install_id = _f;
                        await this._stopOneWorker(install_id);
                    }
                    finally {
                        _h = true;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_h && !_d && (_e = _j.return)) await _e.call(_j);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        catch (e) {
            logger_1.logger.error(e);
        }
        this._syncing = false;
    }
    async _startOneWorker(install) {
        logger_1.logger.info(`New Worker Start id=${install.id}`);
        const wclass = this._app._options.workerClassFunction(install);
        const worker = new wclass(install, this._app, Object.assign(Object.assign({}, this._app._options.obnizOption), { access_token: this._app._options.appToken }));
        this._workers[install.id] = worker;
        await worker.start();
    }
    async _startOrRestartOneWorker(install) {
        const oldWorker = this._workers[install.id];
        if (oldWorker && !(0, fast_equals_1.deepEqual)(oldWorker.install, install)) {
            logger_1.logger.info(`App config changed id=${install.id}`);
            await this._stopOneWorker(install.id);
            await this._startOneWorker(install);
        }
        else if (!oldWorker) {
            await this._startOneWorker(install);
        }
    }
    async _stopOneWorker(installId) {
        logger_1.logger.info(`App Deleted id=${installId}`);
        const worker = this._workers[installId];
        if (worker) {
            delete this._workers[installId];
            // background
            worker
                .stop()
                .then(() => { })
                .catch((e) => {
                logger_1.logger.error(e);
            });
        }
    }
    async _onHeartBeat() {
        if (this._adaptor instanceof RedisAdaptor_1.RedisAdaptor) {
            await this._adaptor.onSlaveHeartbeat();
        }
        else {
            await this._reportToMaster();
        }
    }
    /**
     * Let Master know worker is working.
     */
    async _reportToMaster(masterName) {
        const keys = Object.keys(this._workers);
        await this._adaptor.report(keys, masterName);
    }
    startSyncing() {
        // every minutes
        if (!this._interval) {
            this._interval = setInterval(async () => {
                try {
                    await this._onHeartBeat();
                }
                catch (e) {
                    logger_1.logger.error(e);
                }
            }, 10 * 1000);
            this._onHeartBeat()
                .then()
                .catch((e) => {
                logger_1.logger.error(e);
            });
        }
    }
}
exports.Slave = Slave;
//# sourceMappingURL=Slave.js.map