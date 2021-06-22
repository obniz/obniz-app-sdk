"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = exports.AppInstanceType = void 0;
const Worker_1 = require("./Worker");
const logger_1 = require("./logger");
const Master_1 = require("./Master");
const semver_1 = __importDefault(require("semver"));
const AdaptorFactory_1 = require("./adaptor/AdaptorFactory");
var AppInstanceType;
(function (AppInstanceType) {
    AppInstanceType[AppInstanceType["Master"] = 0] = "Master";
    AppInstanceType[AppInstanceType["Slave"] = 1] = "Slave";
})(AppInstanceType = exports.AppInstanceType || (exports.AppInstanceType = {}));
class App {
    constructor(option) {
        this._workers = {};
        this._interval = null;
        this._syncing = false;
        this.isScalableMode = false;
        this.expressWebhook = this._expressWebhook.bind(this);
        const requiredObnizJsVersion = '3.15.0-alpha.1';
        if (semver_1.default.satisfies(option.obnizClass.version, `<${requiredObnizJsVersion}`)) {
            throw new Error(`obniz.js version > ${requiredObnizJsVersion} is required, but current is ${option.obnizClass.version}`);
        }
        this._options = {
            appToken: option.appToken,
            database: option.database || 'memory',
            databaseConfig: option.databaseConfig,
            workerClass: option.workerClass || Worker_1.Worker,
            workerClassFunction: option.workerClassFunction ||
                (() => {
                    return this._options.workerClass;
                }),
            obnizClass: option.obnizClass,
            instanceType: option.instanceType || AppInstanceType.Master,
            instanceName: option.instanceName || 'master',
            maxWorkerNumPerInstance: option.maxWorkerNumPerInstance || 0,
        };
        if (option.instanceType === AppInstanceType.Master) {
            this._master = new Master_1.Master(option.appToken, this._options.instanceName, this._options.maxWorkerNumPerInstance, this._options.database, this._options.databaseConfig);
        }
        this.isScalableMode = this._options.maxWorkerNumPerInstance > 0;
        if (this._master) {
            // share same adaptor
            this._adaptor = this._master.adaptor;
        }
        else if (this.isScalableMode) {
            if (this._options.database !== 'redis') {
                throw new Error('only support database redis when using scalable mode');
            }
            this._adaptor = new AdaptorFactory_1.AdaptorFactory().create(this._options.database, this._options.instanceName, false, this._options.databaseConfig);
        }
        else {
            throw new Error('invalid options');
        }
        this._adaptor.onSynchronize = async (installs) => {
            await this._synchronize(installs);
        };
        this._adaptor.onReportRequest = async () => {
            await this._reportToMaster();
        };
        this._adaptor.onRequestRequested = async (key) => {
            const results = {};
            for (const install_id in this._workers) {
                results[install_id] = await this._workers[install_id].onRequest(key);
            }
            return results;
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
            this._reportToMaster()
                .then()
                .catch((e) => {
                logger_1.logger.error(e);
            });
        }
    }
    _expressWebhook(req, res) {
        var _a;
        (_a = this._master) === null || _a === void 0 ? void 0 : _a.webhook(req, res);
    }
    start(option) {
        if (this._master) {
            this._master.start(option);
        }
        this._startSyncing();
    }
    async getAllUsers() {
        throw new Error('TODO');
    }
    async getAllObnizes() {
        throw new Error('TODO');
    }
    async getOnlineObnizes() {
        throw new Error('TODO');
    }
    async getOfflineObnizes() {
        throw new Error('TODO');
    }
    async getObnizesOnThisInstance() {
        throw new Error('TODO');
    }
    /**
     * Request a results for specified key for working workers.
     * This function is useful when asking live information.
     * @param key string for request
     * @returns return one object that contains results for keys on each install like {"0000-0000": "result0", "0000-0001": "result1"}
     */
    async request(key) {
        if (this.isScalableMode) {
            throw new Error(`request for scalableMode is not supported yet`);
        }
        return await this._adaptor.request(key);
    }
    async _startOneWorker(install) {
        logger_1.logger.info(`New Worker Start id=${install.id}`);
        const wclass = this._options.workerClassFunction(install);
        const worker = new wclass(install, this);
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
    get obnizClass() {
        return this._options.obnizClass;
    }
}
exports.App = App;
//# sourceMappingURL=App.js.map