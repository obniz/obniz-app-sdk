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
        adaptor.onRequestRequested = async (key) => {
            const results = {};
            for (const install_id in this._workers) {
                results[install_id] = await this._workers[install_id].onRequest(key);
            }
            return results;
        };
        this._adaptor.onSynchronize = async (syncType, installs) => {
            await this._synchronize(syncType, installs);
        };
        this._adaptor.onReportRequest = async () => {
            await this._reportToMaster();
        };
        this._adaptor.onKeyRequest = async (requestId, key) => {
            await this._keyRequestProcess(requestId, key);
        };
    }
    async _keyRequestProcess(requestId, key) {
        const results = {};
        for (const install_id in this._workers) {
            results[install_id] = await this._workers[install_id].onRequest(key);
        }
        await this._adaptor.keyRequestResponse(requestId, this._instanceName, results);
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
     * @param installs
     */
    async _synchronize(syncType, installs) {
        var e_1, _a, e_2, _b;
        if (this._syncing) {
            return;
        }
        this._syncing = true;
        const list = syncType === 'attachList'
            ? installs
            : Object.values(await this._getInstallsFromRedis());
        try {
            const exists = {};
            for (const install_id in this._workers) {
                exists[install_id] = this._workers[install_id];
            }
            try {
                for (var list_1 = __asyncValues(list), list_1_1; list_1_1 = await list_1.next(), !list_1_1.done;) {
                    const install = list_1_1.value;
                    await this._startOrRestartOneWorker(install);
                    if (exists[install.id]) {
                        delete exists[install.id];
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (list_1_1 && !list_1_1.done && (_a = list_1.return)) await _a.call(list_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            try {
                // Apps which not listed
                for (var _c = __asyncValues(Object.keys(exists)), _d; _d = await _c.next(), !_d.done;) {
                    const install_id = _d.value;
                    await this._stopOneWorker(install_id);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_b = _c.return)) await _b.call(_c);
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
        if (oldWorker &&
            JSON.stringify(oldWorker.install) !== JSON.stringify(install)) {
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
    /**
     * Let Master know worker is working.
     */
    async _reportToMaster() {
        if (this._adaptor instanceof RedisAdaptor_1.RedisAdaptor) {
            // If adaptor is Redis
            const redis = this._adaptor.getRedisInstance();
            await redis.set(`slave:${this._app._options.instanceName}:heartbeat`, Date.now(), 'EX', 20);
        }
        else {
            const keys = Object.keys(this._workers);
            await this._adaptor.report(this._app._options.instanceName, keys);
        }
    }
    startSyncing() {
        // every minutes
        if (!this._interval) {
            this._interval = setInterval(async () => {
                try {
                    await this._reportToMaster();
                }
                catch (e) {
                    logger_1.logger.error(e);
                }
            }, 10 * 1000);
            this._reportToMaster()
                .then()
                .catch((e) => {
                logger_1.logger.error(e);
            });
        }
    }
}
exports.Slave = Slave;
//# sourceMappingURL=Slave.js.map