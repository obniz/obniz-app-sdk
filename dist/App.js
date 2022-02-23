"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = exports.AppInstanceType = void 0;
const os = __importStar(require("os"));
const semver_1 = __importDefault(require("semver"));
const Worker_1 = require("./Worker");
const logger_1 = require("./logger");
const Manager_1 = require("./Manager");
const AdaptorFactory_1 = require("./adaptor/AdaptorFactory");
var AppInstanceType;
(function (AppInstanceType) {
    /**
     * Master is Manager + Slave. It communicate with obnizCloud and also works as a worker.
     */
    AppInstanceType[AppInstanceType["Master"] = 0] = "Master";
    /**
     * Manager is managing workers. Never taking a task itself.
     */
    AppInstanceType[AppInstanceType["Manager"] = 2] = "Manager";
    /**
     * Working class. worker needs Manager or Master.
     */
    AppInstanceType[AppInstanceType["Slave"] = 1] = "Slave";
})(AppInstanceType = exports.AppInstanceType || (exports.AppInstanceType = {}));
class App {
    constructor(option) {
        this._workers = {};
        this._interval = null;
        this._syncing = false;
        this.expressWebhook = this._expressWebhook.bind(this);
        // validate obniz.js
        const requiredObnizJsVersion = '3.15.0-alpha.1';
        if (semver_1.default.satisfies(option.obnizClass.version, `<${requiredObnizJsVersion}`)) {
            throw new Error(`obniz.js version > ${requiredObnizJsVersion} is required, but current is ${option.obnizClass.version}`);
        }
        // bind default values.
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
            instanceName: option.instanceName || os.hostname(),
            obnizOption: option.obnizOption || {},
            obnizCloudSdkOption: option.obnizCloudSdkOption || {},
        };
        // detection of pm2 cluster enabled.
        const pm2ClusterEnabled = typeof process.env.NODE_APP_INSTANCE === 'string';
        const isMasterOnSameMachine = !pm2ClusterEnabled || process.env.NODE_APP_INSTANCE === '0';
        if (pm2ClusterEnabled) {
            logger_1.logger.info(`cluster detected. Instance Number = ${process.env.NODE_APP_INSTANCE}`);
            // make unique in same machine
            this._options.instanceName += `-${process.env.NODE_APP_INSTANCE}`;
        }
        if ((option.instanceType === AppInstanceType.Master ||
            option.instanceType === AppInstanceType.Manager) &&
            isMasterOnSameMachine) {
            this._manager = new Manager_1.Manager(option.appToken, this._options.instanceName, this._options.database, this._options.databaseConfig, this._options.obnizCloudSdkOption);
        }
        if (this._manager) {
            // share same adaptor
            this._adaptor = this._manager.adaptor;
        }
        else {
            this._adaptor = new AdaptorFactory_1.AdaptorFactory().create(this._options.database, this._options.instanceName, false, this._options.databaseConfig);
        }
        this._adaptor.onSynchronize = async (installs) => {
            await this._synchronize(installs);
        };
        this._adaptor.onReportRequest = async () => {
            await this._reportToManager();
        };
        this._adaptor.onKeyRequest = async (requestId, key) => {
            await this._keyRequestProcess(requestId, key);
        };
        this._adaptor.onRequestRequested = async (key) => {
            const results = {};
            for (const install_id in this._workers) {
                results[install_id] = await this._workers[install_id].onRequest(key);
            }
            return results;
        };
    }
    async _keyRequestProcess(requestId, key) {
        const results = {};
        for (const install_id in this._workers) {
            results[install_id] = await this._workers[install_id].onRequest(key);
        }
        await this._adaptor.keyRequestResponse(requestId, this._options.instanceName, results);
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
    async _reportToManager() {
        /**
         * Only Report status and letting master know i am exist when worker or master.
         */
        if (!this._manager ||
            (this._manager && this._options.instanceType === AppInstanceType.Master)) {
            const keys = Object.keys(this._workers);
            await this._adaptor.report(this._options.instanceName, keys);
        }
    }
    _startSyncing() {
        // every minutes
        if (!this._interval) {
            this._interval = setInterval(async () => {
                try {
                    await this._reportToManager();
                }
                catch (e) {
                    logger_1.logger.error(e);
                }
            }, 10 * 1000);
            this._reportToManager()
                .then()
                .catch((e) => {
                logger_1.logger.error(e);
            });
        }
    }
    _expressWebhook(req, res) {
        var _a;
        (_a = this._manager) === null || _a === void 0 ? void 0 : _a.webhook(req, res);
    }
    start(option) {
        if (this._manager) {
            this._manager.start(option);
        }
        if (this._options.instanceType === AppInstanceType.Master ||
            this._options.instanceType === AppInstanceType.Manager) {
            this._startSyncing();
        }
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
     * @param timeout Sets the timeout in milliseconds. Default is 5000ms.
     * @returns return one object that contains results for keys on each install like {"0000-0000": "result0", "0000-0001": "result1"}
     */
    async request(key, timeout = 30 * 1000) {
        if (!this._manager) {
            throw new Error(`This function is only available on master`);
        }
        return await this._manager.request(key, timeout);
    }
    async _startOneWorker(install) {
        logger_1.logger.info(`New Worker Start id=${install.id}`);
        let access_token = this._options.appToken;
        // @ts-ignore
        if (this._appTokenForObniz) {
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            access_token = this._appTokenForObniz(install);
        }
        const wclass = this._options.workerClassFunction(install);
        const worker = new wclass(install, this, Object.assign(Object.assign({}, this._options.obnizOption), { access_token }));
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