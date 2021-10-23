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
const Master_1 = require("./Master");
const AdaptorFactory_1 = require("./adaptor/AdaptorFactory");
const Slave_1 = require("./Slave");
var AppInstanceType;
(function (AppInstanceType) {
    AppInstanceType[AppInstanceType["Master"] = 0] = "Master";
    AppInstanceType[AppInstanceType["Slave"] = 1] = "Slave";
})(AppInstanceType = exports.AppInstanceType || (exports.AppInstanceType = {}));
class App {
    constructor(option) {
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
        if (option.instanceType === AppInstanceType.Master &&
            isMasterOnSameMachine) {
            this._master = new Master_1.Master(option.appToken, this._options.instanceName, this._options.database, this._options.databaseConfig, this._options.obnizCloudSdkOption);
        }
        // If master mode, share adaptor
        const adaptor = this._master
            ? this._master.adaptor
            : new AdaptorFactory_1.AdaptorFactory().create(this._options.database, this._options.instanceName, false, this._options.databaseConfig);
        this._slave = new Slave_1.Slave(adaptor, this._options.instanceName, this);
    }
    _expressWebhook(req, res) {
        var _a;
        (_a = this._master) === null || _a === void 0 ? void 0 : _a.webhook(req, res);
    }
    start(option) {
        if (this._master) {
            this._master.start(option);
        }
        this._slave.startSyncing();
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
        if (!this._master) {
            throw new Error(`This function is only available on master`);
        }
        return await this._master.request(key, timeout);
    }
    get obnizClass() {
        return this._options.obnizClass;
    }
}
exports.App = App;
//# sourceMappingURL=App.js.map