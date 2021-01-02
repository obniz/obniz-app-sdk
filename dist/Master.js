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
    constructor(appToken, instanceName, scaleFactor) {
        this._syncing = false;
        this._allInstalls = {};
        this._allWorkerInstances = {};
        this._appToken = appToken;
        this.scaleFactor = scaleFactor;
        if (scaleFactor > 0) {
            this.adaptor = new redis_1.default(instanceName, true);
        }
        else {
            this.adaptor = new adaptor_1.default();
        }
        this.adaptor.onReported = async (instanceName, installIds) => {
            // logger.debug(`receive report ${instanceName}`)
            const exist = this._allWorkerInstances[instanceName];
            if (exist) {
                exist.installIds = installIds;
                exist.updatedMilissecond = Date.now().valueOf();
            }
            else {
                this._allWorkerInstances[instanceName] = {
                    name: instanceName,
                    installIds: installIds,
                    updatedMilissecond: Date.now().valueOf()
                };
                this.onInstanceAttached(instanceName);
            }
            this.onInstanceReported(instanceName);
        };
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
        this._startOptions.express.get(this._startOptions.webhookUrl, this._webhook.bind(this));
        this._startOptions.express.post(this._startOptions.webhookUrl, this._webhook.bind(this));
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
    /**
     * 空き状況から最適なWorkerを推測
     */
    bestWorkerInstance() {
        let installCounts = {};
        for (const name in this._allWorkerInstances) {
            installCounts[name] = 0;
        }
        for (const id in this._allInstalls) {
            const managedInstall = this._allInstalls[id];
            installCounts[managedInstall.instanceName] += 1;
        }
        let minNumber = 1000 * 1000;
        let minInstance = null;
        for (const key in installCounts) {
            if (installCounts[key] < minNumber) {
                minInstance = this._allWorkerInstances[key];
                minNumber = installCounts[key];
            }
        }
        if (!minInstance) {
            throw new Error(`No Valid Instance`);
        }
        return minInstance;
    }
    /**
     * incetanceId がidのWorkerが新たに参加した
     * @param id
     */
    onInstanceAttached(instanceName) {
        const worker = this._allWorkerInstances[instanceName];
        // TODO: Overloadのinstanceがあれば引っ越しさせる
    }
    /**
     * incetanceId がidのWorkerが喪失した
     * @param id
     */
    onInstanceMissed(instanceName) {
        // delete immidiately
        const diedWorker = this._allWorkerInstances[instanceName];
        delete this._allWorkerInstances[instanceName];
        // Replacing missed instance workers.
        for (const id in this._allInstalls) {
            const managedInstall = this._allInstalls[id];
            if (managedInstall.instanceName === diedWorker.name) {
                const nextWorker = this.bestWorkerInstance();
                managedInstall.instanceName = nextWorker.name;
                managedInstall.status = InstallStatus.Starting;
            }
        }
        // synchronize
        this.synchronize().then().catch(e => {
            logger_1.logger.error(e);
        });
    }
    /**
     * incetanceId がidのWorkerから新しい情報が届いた（定期的に届く）
     * @param id
     */
    onInstanceReported(instanceName) {
        const worker = this._allWorkerInstances[instanceName];
        for (const existId of worker.installIds) {
            const managedInstall = this._allInstalls[existId];
            if (managedInstall) {
                managedInstall.status = InstallStatus.Started;
                managedInstall.updatedMilissecond = Date.now().valueOf();
            }
            else {
                // ghost
                logger_1.logger.debug(`Ignore ghost ${instanceName}`);
            }
        }
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
            // logger.debug("sync api start");
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
            if (mustaddds.length + updateds.length + deleted.length > 0) {
                logger_1.logger.debug(`all \t| added \t| updated \t| deleted`);
                logger_1.logger.debug(`${installs_api.length} \t| ${mustaddds.length} \t| ${updateds.length} \t| ${deleted.length}`);
            }
            for (const install of updateds) {
                const managedInstall = this._allInstalls[install.id];
                managedInstall.install = install;
            }
            for (const managedInstall of deleted) {
                managedInstall.status = InstallStatus.Stopping;
                delete this._allInstalls[managedInstall.install.id];
            }
            for (const install of mustaddds) {
                const instance = this.bestWorkerInstance(); // maybe throw
                const managedInstall = {
                    instanceName: instance.name,
                    status: InstallStatus.Starting,
                    updatedMilissecond: Date.now().valueOf(),
                    install
                };
                this._allInstalls[install.id] = managedInstall;
            }
            await this.synchronize();
        }
        catch (e) {
            console.error(e);
        }
        this._syncing = false;
    }
    async synchronize() {
        let separeted = {};
        for (const id in this._allInstalls) {
            const managedInstall = this._allInstalls[id];
            const instanceName = managedInstall.instanceName;
            if (!separeted[instanceName]) {
                separeted[instanceName] = [];
            }
            separeted[instanceName].push(managedInstall.install);
        }
        //
        for (const instanceName in separeted) {
            logger_1.logger.debug(`synchonize sent to ${instanceName} idsCount=${separeted[instanceName].length}`);
            await this.adaptor.synchronize(instanceName, separeted[instanceName]);
        }
    }
    _healthCheck() {
        const current = Date.now().valueOf();
        // each install
        // for (const id in this._allInstalls) {
        //   const managedInstall = this._allInstalls[id];
        //   if (managedInstall.updatedMilissecond + 60 * 1000 < current) {
        //     // over time.
        //     this._onHealthCheckFailedInstall(managedInstall);
        //   }
        // }
        // each room
        for (const id in this._allWorkerInstances) {
            const workerInstance = this._allWorkerInstances[id];
            if (workerInstance.updatedMilissecond + 30 * 1000 < current) {
                // over time.
                this._onHealthCheckFailedWorkerInstance(workerInstance);
            }
        }
    }
    // private _onHealthCheckFailedInstall(managedInstall: ManagedInstall) {
    //   logger.warn(`healthcheck failed install ${managedInstall.install.id}`)
    // }
    _onHealthCheckFailedWorkerInstance(workerInstance) {
        logger_1.logger.warn(`healthcheck failed worker ${workerInstance.name}`);
        this.onInstanceMissed(workerInstance.name);
    }
}
exports.default = Master;
//# sourceMappingURL=Master.js.map