"use strict";
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
        this._adaptor.onSynchronize = async (installs) => {
            await this._synchronize(installs);
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
    /**
     * Receive Master Generated List and compare current apps.
     * @param installs
     */
    async _synchronize(installs) {
        try {
            if (this._syncing) {
                return;
            }
            this._syncing = true;
            // logger.debug("receive synchronize message");
            const exists = {};
            for (const install_id in this._workers) {
                exists[install_id] = this._workers[install_id];
            }
            for (const install of installs) {
                await this._startOrRestartOneWorker(install);
                if (exists[install.id]) {
                    delete exists[install.id];
                }
            }
            // Apps which not listed
            for (const install_id in exists) {
                await this._stopOneWorker(install_id);
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
        const keys = Object.keys(this._workers);
        if (this._adaptor instanceof RedisAdaptor_1.RedisAdaptor) {
            // If adaptor is Redis
            const redis = this._adaptor.getRedisInstance();
            await redis.set(`slave:${this._app._options.instanceName}:heartbeat`, Date.now(), 'EX', 20);
        }
        await this._adaptor.report(this._app._options.instanceName, keys);
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