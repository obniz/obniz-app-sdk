"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Master = void 0;
const logger_1 = require("./logger");
const install_1 = require("./install");
const express_1 = __importDefault(require("express"));
const AdaptorFactory_1 = require("./adaptor/AdaptorFactory");
var InstallStatus;
(function (InstallStatus) {
    InstallStatus[InstallStatus["Starting"] = 0] = "Starting";
    InstallStatus[InstallStatus["Started"] = 1] = "Started";
    InstallStatus[InstallStatus["Stopping"] = 2] = "Stopping";
    InstallStatus[InstallStatus["Stopped"] = 3] = "Stopped";
})(InstallStatus || (InstallStatus = {}));
class Master {
    constructor(appToken, instanceName, maxWorkerNumPerInstance, database, databaseConfig, obnizSdkOption) {
        this._syncing = false;
        this._allInstalls = {};
        this._allWorkerInstances = {};
        this.webhook = this._webhook.bind(this);
        this._appToken = appToken;
        this.maxWorkerNumPerInstance = maxWorkerNumPerInstance;
        this._obnizSdkOption = obnizSdkOption;
        if (maxWorkerNumPerInstance > 0) {
            if (database !== 'redis') {
                throw new Error('Supported database type is only redis now.');
            }
            this.adaptor = new AdaptorFactory_1.AdaptorFactory().create(database, instanceName, true, databaseConfig);
        }
        else {
            this.adaptor = new AdaptorFactory_1.AdaptorFactory().create(database, instanceName, true, databaseConfig);
        }
        this.adaptor.onReported = async (reportInstanceName, installIds) => {
            // logger.debug(`receive report ${reportInstanceName}`)
            const exist = this._allWorkerInstances[reportInstanceName];
            if (exist) {
                exist.installIds = installIds;
                exist.updatedMillisecond = Date.now().valueOf();
            }
            else {
                this._allWorkerInstances[reportInstanceName] = {
                    name: reportInstanceName,
                    installIds,
                    updatedMillisecond: Date.now().valueOf(),
                };
                this.onInstanceAttached(reportInstanceName);
            }
            this.onInstanceReported(reportInstanceName);
        };
    }
    start(option) {
        this._startWeb(option);
        this._startSyncing();
        this._startHealthCheck();
    }
    _startWeb(option) {
        option = option || {};
        if (option.express === false) {
            // nothing
            return;
        }
        this._startOptions = {
            express: option.express || express_1.default(),
            webhookUrl: option.webhookUrl || '/webhook',
            port: option.port || 3333,
        };
        this._startOptions.express.get(this._startOptions.webhookUrl, this.webhook);
        this._startOptions.express.post(this._startOptions.webhookUrl, this.webhook);
        if (!option.express) {
            this._startOptions.express.listen(this._startOptions.port, () => {
                logger_1.logger.debug(`App listening on http://localhost:${(this._startOptions || {}).port} `);
            });
        }
    }
    async _webhook(_, res) {
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
        const installCounts = {};
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
     * instanceId がidのWorkerが新たに参加した
     * @param id
     */
    onInstanceAttached(instanceName) {
        // const worker: WorkerInstance = this._allWorkerInstances[instanceName];
        // TODO: Overloadのinstanceがあれば引っ越しさせる
    }
    /**
     * instanceId がidのWorkerが喪失した
     * @param id
     */
    onInstanceMissed(instanceName) {
        // delete immediately
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
        this.synchronize()
            .then()
            .catch((e) => {
            logger_1.logger.error(e);
        });
    }
    /**
     * instanceId がidのWorkerから新しい情報が届いた（定期的に届く）
     * @param id
     */
    onInstanceReported(instanceName) {
        const worker = this._allWorkerInstances[instanceName];
        for (const existId of worker.installIds) {
            const managedInstall = this._allInstalls[existId];
            if (managedInstall) {
                managedInstall.status = InstallStatus.Started;
                managedInstall.updatedMillisecond = Date.now().valueOf();
            }
            else {
                // ghost
                logger_1.logger.debug(`Ignore ghost ${instanceName}`);
            }
        }
    }
    _startSyncing() {
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
            this._syncInstalls()
                .then()
                .catch((e) => {
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
            const installsApi = [];
            try {
                installsApi.push(...(await install_1.sharedInstalledDeviceManager.getListFromObnizCloud(this._appToken, this._obnizSdkOption)));
            }
            catch (e) {
                console.error(e);
                process.exit(-1);
            }
            /**
             * Compare with currents
             */
            const mustAdds = [];
            const updated = [];
            const deleted = [];
            for (const install of installsApi) {
                let found = false;
                for (const id in this._allInstalls) {
                    const oldInstall = this._allInstalls[id].install;
                    if (install.id === id) {
                        if (JSON.stringify(install) !== JSON.stringify(oldInstall)) {
                            // updated
                            updated.push(install);
                        }
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    mustAdds.push(install);
                }
            }
            for (const id in this._allInstalls) {
                let found = false;
                for (const install of installsApi) {
                    if (id === install.id) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    deleted.push(this._allInstalls[id]);
                }
            }
            if (mustAdds.length + updated.length + deleted.length > 0) {
                logger_1.logger.debug(`all \t| added \t| updated \t| deleted`);
                logger_1.logger.debug(`${installsApi.length} \t| ${mustAdds.length} \t| ${updated.length} \t| ${deleted.length}`);
            }
            for (const install of updated) {
                const managedInstall = this._allInstalls[install.id];
                managedInstall.install = install;
            }
            for (const managedInstall of deleted) {
                managedInstall.status = InstallStatus.Stopping;
                delete this._allInstalls[managedInstall.install.id];
            }
            for (const install of mustAdds) {
                const instance = this.bestWorkerInstance(); // maybe throw
                const managedInstall = {
                    instanceName: instance.name,
                    status: InstallStatus.Starting,
                    updatedMillisecond: Date.now().valueOf(),
                    install,
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
        const separated = {};
        for (const id in this._allInstalls) {
            const managedInstall = this._allInstalls[id];
            const instanceName = managedInstall.instanceName;
            if (!separated[instanceName]) {
                separated[instanceName] = [];
            }
            separated[instanceName].push(managedInstall.install);
        }
        //
        for (const instanceName in separated) {
            logger_1.logger.debug(`synchronize sent to ${instanceName} idsCount=${separated[instanceName].length}`);
            await this.adaptor.synchronize(instanceName, separated[instanceName]);
        }
    }
    _healthCheck() {
        const current = Date.now().valueOf();
        // each install
        // for (const id in this._allInstalls) {
        //   const managedInstall = this._allInstalls[id];
        //   if (managedInstall.updatedMillisecond + 60 * 1000 < current) {
        //     // over time.
        //     this._onHealthCheckFailedInstall(managedInstall);
        //   }
        // }
        // each room
        for (const id in this._allWorkerInstances) {
            const workerInstance = this._allWorkerInstances[id];
            if (workerInstance.updatedMillisecond + 30 * 1000 < current) {
                // over time.
                this._onHealthCheckFailedWorkerInstance(workerInstance);
            }
        }
    }
    // private _onHealthCheckFailedInstall(managedInstall: ManagedInstall) {
    //   logger.warn(`health check failed install ${managedInstall.install.id}`)
    // }
    _onHealthCheckFailedWorkerInstance(workerInstance) {
        logger_1.logger.warn(`health check failed worker ${workerInstance.name}`);
        this.onInstanceMissed(workerInstance.name);
    }
}
exports.Master = Master;
//# sourceMappingURL=Master.js.map