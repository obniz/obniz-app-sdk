"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("./logger");
const Master_1 = require("./Master");
const RedisAdaptor_1 = require("./adaptor/RedisAdaptor");
var AppInstanceType;
(function (AppInstanceType) {
    AppInstanceType[AppInstanceType["WebAndWorker"] = 0] = "WebAndWorker";
    AppInstanceType[AppInstanceType["Worker"] = 1] = "Worker";
})(AppInstanceType = exports.AppInstanceType || (exports.AppInstanceType = {}));
class App {
    constructor(option) {
        this._workers = {};
        this._syncing = false;
        this._options = {
            appToken: option.appToken,
            database: option.database || "redis",
            workerClass: option.workerClass,
            instanceType: option.instanceType || AppInstanceType.WebAndWorker,
            instanceName: option.instanceName || 'master',
            scaleFactor: option.scaleFactor || 0
        };
        if (option.instanceType === AppInstanceType.WebAndWorker) {
            this._master = new Master_1.Master(option.appToken, this._options.instanceName, this._options.scaleFactor);
        }
        if (this._options.scaleFactor > 0) {
            this._adaptor = new RedisAdaptor_1.RedisAdaptor(this._options.instanceName, false);
        }
        else {
            // share same adaptor
            this._adaptor = this._master.adaptor;
        }
        this._adaptor.onSynchronize = async (installs) => {
            await this._synchronize(installs);
        };
        this._adaptor.onReportRequest = async () => {
            await this._reportToMaster();
        };
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
    /**
     * Let Master know worker is working.
     */
    async _reportToMaster() {
        const keys = Object.keys(this._workers);
        await this._adaptor.report(this._options.instanceName, keys);
    }
    _startSyncing() {
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
            this._reportToMaster().then().catch(e => {
                logger_1.logger.error(e);
            });
        }
    }
    start(option) {
        if (this._master) {
            this._master.start(option);
        }
        this._startSyncing();
    }
    getAllUsers() {
    }
    getAllObnizes() {
    }
    getOnlineObnizes() {
    }
    getOfflineObnizes() {
    }
    getObnizesOnThisInstance() {
    }
    async _startOneWorker(install) {
        logger_1.logger.info(`New App Start id=${install.id}`);
        const worker = new this._options.workerClass(install, this);
        this._workers[install.id] = worker;
        await worker.start();
    }
    async _startOrRestartOneWorker(install) {
        const oldWorker = this._workers[install.id];
        if (oldWorker && JSON.stringify(oldWorker.install) !== JSON.stringify(install)) {
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
            //background
            worker
                .stop()
                .then(() => {
            })
                .catch((e) => {
                logger_1.logger.error(e);
            });
        }
    }
}
exports.App = App;
//# sourceMappingURL=App.js.map