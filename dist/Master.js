"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("./logger");
const install_1 = require("./install");
const adaptor_1 = __importDefault(require("./adaptor/adaptor"));
const redis_1 = __importDefault(require("./adaptor/redis"));
const express_1 = __importDefault(require("express"));
var InstallStatus;
(function (InstallStatus) {
    InstallStatus[InstallStatus["Starting"] = 0] = "Starting";
    InstallStatus[InstallStatus["Started"] = 1] = "Started";
    InstallStatus[InstallStatus["Stopping"] = 2] = "Stopping";
    InstallStatus[InstallStatus["Stopped"] = 3] = "Stopped";
})(InstallStatus || (InstallStatus = {}));
class Master {
    constructor(appToken, scaleFactor) {
        this._syncing = false;
        this._allInstalls = {};
        this._allWorkerInstances = {};
        this._appToken = appToken;
        if (scaleFactor > 0) {
            const adaptor = new redis_1.default('master');
            adaptor.onInstanceInfoUpdated = async (info) => {
                const exist = this._allWorkerInstances[info.from];
                if (exist) {
                    exist.updatedMilissecond = Date.now().valueOf();
                }
                else {
                    this._allWorkerInstances[info.from] = {
                        name: info.from,
                        installIds: info.installIds,
                        updatedMilissecond: Date.now().valueOf()
                    };
                }
            };
            this.adaptor = adaptor;
        }
        else {
            this.adaptor = new adaptor_1.default();
        }
    }
    start(option) {
        this._startWeb(option);
        this._startSynching();
        this._startHealthCheck();
    }
    _startWeb(option) {
        option = option || {};
        this._startOptions = {
            express: option.express || express_1.default(),
            webhookUrl: option.webhookUrl || "/webhook",
            port: option.port || 3333
        };
        this._startOptions.express.get(this._startOptions.webhookUrl, this._webhook);
        this._startOptions.express.post(this._startOptions.webhookUrl, this._webhook);
        if (!option.express) {
            this._startOptions.express.listen(this._startOptions.port, () => {
                const port = this._startOptions ? this._startOptions.port : undefined;
            });
        }
    }
    async _webhook(req, res, next) {
        // TODO : check Instance and start
        try {
            await this._syncInstalls();
        }
        catch (e) {
            logger_1.logger.error(e);
            res.status(500).json({});
            return;
        }
        res.json({});
    }
    bestWorkerInstance() {
        let minInstall = undefined;
        for (const id in this._allWorkerInstances) {
            const workerInstance = this._allWorkerInstances[id];
            if (!minInstall || workerInstance.installIds.length < minInstall.installIds.length) {
                minInstall = workerInstance;
            }
        }
        if (!minInstall) {
            throw new Error(`No Instance Found`);
        }
        return minInstall;
    }
    _startSynching() {
        // every minutes
        if (!this._interval) {
            this._interval = setInterval(async () => {
                try {
                    await this._syncInstalls();
                }
                catch (e) {
                    logger_1.logger.error(e);
                }
            }, 60 * 1000);
            this._syncInstalls().then().catch(e => {
                logger_1.logger.error(e);
            });
        }
    }
    _startHealthCheck() {
        setInterval(async () => {
            try {
                this._healthCheck();
            }
            catch (e) {
                logger_1.logger.error(e);
            }
        }, 10 * 1000);
    }
    async _syncInstalls() {
        try {
            if (this._syncing) {
                return;
            }
            this._syncing = true;
            logger_1.logger.debug("sync api start");
            const installs_api = [];
            try {
                installs_api.push(...await install_1.getInstallRequest(this._appToken));
            }
            catch (e) {
                console.error(e);
                process.exit(-1);
            }
            /**
             * Compare with currents
             */
            const mustaddds = [];
            const updateds = [];
            const deleted = [];
            for (const install of installs_api) {
                let found = false;
                for (const id in this._allInstalls) {
                    const oldInstall = this._allInstalls[id].install;
                    if (install.id === id) {
                        if (JSON.stringify(install) !== JSON.stringify(oldInstall)) {
                            // updated
                            updateds.push(install);
                        }
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    mustaddds.push(install);
                }
            }
            for (const id in this._allInstalls) {
                let found = false;
                for (const install of installs_api) {
                    if (id === install.id) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    deleted.push(this._allInstalls[id]);
                }
            }
            logger_1.logger.debug(`loaded installs ${installs_api.length}`);
            logger_1.logger.debug(`new installs ${mustaddds.length}`);
            logger_1.logger.debug(`updated installs ${updateds.length}`);
            logger_1.logger.debug(`deleted installs ${deleted.length}`);
            for (const install of mustaddds) {
                const instance = this.bestWorkerInstance(); // maybe throw
                const managedInstall = {
                    instanceName: instance.name,
                    status: InstallStatus.Starting,
                    updatedMilissecond: Date.now().valueOf(),
                    install
                };
                this._allInstalls[install.id] = managedInstall;
                await this.adaptor.start(install, managedInstall.instanceName);
            }
            for (const install of updateds) {
                const managedInstall = this._allInstalls[install.id];
                managedInstall.updatedMilissecond = Date.now().valueOf();
                await this.adaptor.update(install, managedInstall.instanceName);
            }
            for (const managedInstall of deleted) {
                if (managedInstall.status === InstallStatus.Stopping || managedInstall.status === InstallStatus.Stopped) {
                    continue;
                }
                managedInstall.updatedMilissecond = Date.now().valueOf();
                managedInstall.status = InstallStatus.Stopping;
                await this.adaptor.stop(managedInstall.install, managedInstall.instanceName);
            }
        }
        catch (e) {
            logger_1.logger.error(e);
        }
        this._syncing = false;
    }
    _healthCheck() {
        const current = Date.now().valueOf();
        // each install
        for (const id in this._allInstalls) {
            const managedInstall = this._allInstalls[id];
            if (managedInstall.updatedMilissecond + 60 * 1000 < current) {
                // over time.
                this._onHealthCheckFailedInstall(managedInstall);
            }
        }
        // each room
        for (const id in this._allWorkerInstances) {
            const workerInstance = this._allWorkerInstances[id];
            if (workerInstance.updatedMilissecond + 60 * 1000 < current) {
                // over time.
                this._onHealthCheckFailedWorkerInstance(workerInstance);
            }
        }
    }
    _onHealthCheckFailedInstall(managedInstall) {
        logger_1.logger.warn(`healthcheck failed install ${managedInstall.install.id}`);
    }
    _onHealthCheckFailedWorkerInstance(workerInstance) {
        logger_1.logger.warn(`healthcheck failed worker ${workerInstance.name}`);
    }
}
exports.default = Master;
//# sourceMappingURL=Master.js.map