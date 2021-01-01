"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = exports.AppInstanceType = void 0;
const logger_1 = require("./logger");
const Master_1 = __importDefault(require("./Master"));
const redis_1 = __importDefault(require("./adaptor/redis"));
var AppInstanceType;
(function (AppInstanceType) {
    AppInstanceType[AppInstanceType["WebAndWorker"] = 0] = "WebAndWorker";
    AppInstanceType[AppInstanceType["Worker"] = 1] = "Worker";
})(AppInstanceType = exports.AppInstanceType || (exports.AppInstanceType = {}));
class App {
    constructor(option) {
        this._workers = {};
        this._options = {
            appToken: option.appToken,
            database: option.database || "postgresql",
            workerClass: option.workerClass,
            instanceType: option.instanceType || AppInstanceType.WebAndWorker,
            instanceName: option.instanceName || 'master',
            scaleFactor: option.scaleFactor || 0
        };
        if (option.instanceType === AppInstanceType.WebAndWorker) {
            this._master = new Master_1.default(option.appToken, this._options.scaleFactor);
        }
        if (this._options.scaleFactor > 0) {
            this._adaptor = new redis_1.default((this._options.instanceName === 'master') ? 'master-worker' : this._options.instanceName);
        }
        else {
            this._adaptor = this._master.adaptor;
        }
        // on start
        this._adaptor.onStart = async (install) => {
            logger_1.logger.info(`App start id=${install.id}`);
            const oldWorker = this._workers[install.id];
            if (oldWorker) {
                oldWorker
                    .stop()
                    .then(() => {
                })
                    .catch((e) => {
                    logger_1.logger.error(e);
                });
            }
            const app = new this._options.workerClass(install, this);
            this._workers[install.id] = app;
            await this._startOneWorker(app);
        };
        // on update
        this._adaptor.onUpdate = async (install) => {
            logger_1.logger.info(`App config changed id=${install.id}`);
            const oldWorker = this._workers[install.id];
            if (oldWorker) {
                oldWorker
                    .stop()
                    .then(() => {
                })
                    .catch((e) => {
                    logger_1.logger.error(e);
                });
            }
            const app = new this._options.workerClass(install, this);
            this._workers[install.id] = app;
            await this._restartOneWorker(app);
        };
        // on stop
        this._adaptor.onStop = async (install) => {
            logger_1.logger.info(`App stop id=${install.id}`);
            const oldWorker = this._workers[install.id];
            if (oldWorker) {
                oldWorker
                    .stop()
                    .then(() => {
                })
                    .catch((e) => {
                    logger_1.logger.error(e);
                });
                delete this._workers[install.id];
                await this._stopOneWorker(oldWorker);
            }
        };
    }
    // 必須なのでオプションでいいのでは
    // registerApplication(workerClass:new () => Worker){
    //
    //
    // }
    onInstall(user, install) {
    }
    onUninstall(user, install) {
    }
    start(option) {
        if (this._master) {
            this._master.start(option);
        }
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
    _startOneWorker(worker) {
    }
    _stopOneWorker(worker) {
    }
    _restartOneWorker(worker) {
    }
}
exports.App = App;
//# sourceMappingURL=App.js.map