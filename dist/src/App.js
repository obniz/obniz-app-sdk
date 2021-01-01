"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = exports.AppInstanceType = void 0;
const express_1 = __importDefault(require("express"));
const logger_1 = require("./logger");
const install_1 = require("./install");
var AppInstanceType;
(function (AppInstanceType) {
    AppInstanceType[AppInstanceType["Web"] = 0] = "Web";
    AppInstanceType[AppInstanceType["Worker"] = 1] = "Worker";
})(AppInstanceType = exports.AppInstanceType || (exports.AppInstanceType = {}));
class App {
    constructor(option) {
        this._syncing = false;
        this._workers = {};
        this._options = {
            appToken: option.appToken,
            database: option.database || "postgresql",
            workerClass: option.workerClass,
            instanceType: option.instanceType
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
        option = option || {};
        this._startOptions = {
            express: option.express || express_1.default(),
            webhookUrl: option.webhookUrl || "/webhook",
            port: option.port || 3333
        };
        this._startOptions.express.get(this._startOptions.webhookUrl, this._webhook);
        if (!option.express) {
            this._startOptions.express.listen(this._startOptions.port, () => {
                const port = this._startOptions ? this._startOptions.port : undefined;
                console.log('Example app listening on port ' + port);
                console.log('localhost:  http://localhost:' + port);
            });
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
    _webhook(req, res, next) {
        // TODO : check Instance and start
    }
    _startOneWorker(worker) {
    }
    _stopOneWorker(worker) {
    }
    _restartOneWorker(worker) {
    }
    async _syncInstalls() {
        try {
            if (this._syncing) {
                return;
            }
            this._syncing = true;
            // logger.debug("sync api start");
            const apiInstalls = {};
            let installs_api = [];
            try {
                installs_api = await install_1.getInstallRequest(this._options.appToken);
                for (const install of installs_api) {
                    apiInstalls[install.id] = install;
                }
            }
            catch (e) {
                // logger.error(e);
                process.exit();
            }
            // 稼働中の報告があるID一覧
            // logger.debug(`API install ids:    ${JSON.stringify(Object.keys(apiInstalls), null, 2)}`);
            // logger.debug(`working ids:    ${JSON.stringify(Object.keys(this.apps), null, 2)}`);
            const exists = {};
            for (const install_id in this._workers) {
                exists[install_id] = this._workers[install_id];
            }
            for (const install_id in apiInstalls) {
                const install = apiInstalls[install_id];
                if (exists[install_id]) {
                    const oldApp = this._workers[install_id];
                    if (oldApp.install.configs !== install.configs) {
                        // config changed
                        logger_1.logger.info(`App config changed id=${install.id}`);
                        const app = new this._options.workerClass(install, this);
                        this._workers[install.id] = app;
                        oldApp
                            .stop()
                            .then(() => {
                        })
                            .catch((e) => {
                            logger_1.logger.error(e);
                        });
                        await this._startOneWorker(app);
                    }
                    delete exists[install_id];
                }
                else {
                    logger_1.logger.info(`New App Start id=${install.id}`);
                    const app = new this._options.workerClass(install, this);
                    this._workers[install.id] = app;
                    await this._startOneWorker(app);
                }
            }
            for (const install_id in exists) {
                const oldApp = this._workers[install_id];
                if (oldApp) {
                    logger_1.logger.info(`App Deleted id=${install_id}`);
                    delete this._workers[install_id];
                    oldApp
                        .stop()
                        .then(() => {
                    })
                        .catch((e) => {
                        logger_1.logger.error(e);
                    });
                }
            }
        }
        catch (e) {
            logger_1.logger.error(e);
        }
        this._syncing = false;
    }
}
exports.App = App;
//# sourceMappingURL=App.js.map