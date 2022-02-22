"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Manager = void 0;
const logger_1 = require("./logger");
const obnizCloudClient_1 = require("./obnizCloudClient");
const express_1 = __importDefault(require("express"));
const AdaptorFactory_1 = require("./adaptor/AdaptorFactory");
const tools_1 = require("./tools");
const Errors_1 = require("./Errors");
const MemoryWorkerStore_1 = require("./worker_store/MemoryWorkerStore");
const RedisAdaptor_1 = require("./adaptor/RedisAdaptor");
const RedisWorkerStore_1 = require("./worker_store/RedisWorkerStore");
var InstallStatus;
(function (InstallStatus) {
    InstallStatus[InstallStatus["Starting"] = 0] = "Starting";
    InstallStatus[InstallStatus["Started"] = 1] = "Started";
    InstallStatus[InstallStatus["Stopping"] = 2] = "Stopping";
    InstallStatus[InstallStatus["Stopped"] = 3] = "Stopped";
})(InstallStatus || (InstallStatus = {}));
class Manager {
    constructor(appToken, instanceName, database, databaseConfig, obnizSdkOption) {
        this._syncing = false;
        this._allInstalls = {};
        // Note: moved to _workerStore
        // private _allWorkerInstances: { [key: string]: WorkerInstance } = {};
        this._keyRequestExecutes = {};
        this._currentAppEventsSequenceNo = 0;
        this.webhook = this._webhook.bind(this);
        this._appToken = appToken;
        this._obnizSdkOption = obnizSdkOption;
        this._instanceName = instanceName;
        this.adaptor = new AdaptorFactory_1.AdaptorFactory().create(database, instanceName, true, databaseConfig);
        /**
         * Workerのうちいずれかから状況報告をもらった
         * これが初回連絡の場合、onInstanceAttached()が呼ばれる
         */
        this.adaptor.onReported = async (reportInstanceName, installIds) => {
            const exist = await this._workerStore.getWorkerInstance(reportInstanceName);
            if (exist) {
                await this._workerStore.updateWorkerInstance(reportInstanceName, {
                    installIds,
                    updatedMillisecond: Date.now(),
                });
            }
            else {
                this._workerStore.addWorkerInstance(reportInstanceName, {
                    installIds,
                    updatedMillisecond: Date.now(),
                });
                this.onInstanceAttached(reportInstanceName);
            }
            await this.onInstanceReported(reportInstanceName);
        };
        this.adaptor.onKeyRequestResponse = async (requestId, fromInstanceName, results) => {
            if (this._keyRequestExecutes[requestId]) {
                this._keyRequestExecutes[requestId].results = Object.assign(Object.assign({}, this._keyRequestExecutes[requestId].results), results);
                this._keyRequestExecutes[requestId].returnedInstanceCount++;
                if (this._keyRequestExecutes[requestId].returnedInstanceCount ===
                    this._keyRequestExecutes[requestId].waitingInstanceCount) {
                    this._keyRequestExecutes[requestId].resolve(this._keyRequestExecutes[requestId].results);
                    delete this._keyRequestExecutes[requestId];
                }
            }
        };
        if (this.adaptor instanceof RedisAdaptor_1.RedisAdaptor) {
            this._workerStore = new RedisWorkerStore_1.RedisWorkerStore(this.adaptor);
        }
        else {
            this._workerStore = new MemoryWorkerStore_1.MemoryWorkerStore();
        }
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
    async _webhook(req, res) {
        // TODO : check Instance and start
        try {
            await this._syncInstalls(true);
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
    async bestWorkerInstance() {
        const installCounts = {};
        const instances = await this._workerStore.getAllWorkerInstances();
        for (const name in instances) {
            installCounts[name] = 0;
        }
        for (const id in this._allInstalls) {
            const managedInstall = this._allInstalls[id];
            if (installCounts[managedInstall.instanceName] === undefined)
                continue;
            installCounts[managedInstall.instanceName] += 1;
        }
        let minNumber = 1000 * 1000;
        let minInstance = null;
        for (const key in installCounts) {
            if (installCounts[key] < minNumber) {
                minInstance = instances[key];
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
        logger_1.logger.info(`new worker recognized ${instanceName}`);
    }
    /**
     * instanceId がidのWorkerが喪失した
     * @param id
     */
    async onInstanceMissed(instanceName) {
        logger_1.logger.info(`worker lost ${instanceName}`);
        // delete immediately
        const diedWorker = await this._workerStore.getWorkerInstance(instanceName);
        if (!diedWorker)
            throw new Error('Failed get diedWorker status');
        await this._workerStore.deleteWorkerInstance(instanceName);
        // Replacing missed instance workers.
        for (const id in this._allInstalls) {
            const managedInstall = this._allInstalls[id];
            if (managedInstall.instanceName === diedWorker.name) {
                const nextWorker = await this.bestWorkerInstance();
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
    async onInstanceReported(instanceName) {
        const worker = await this._workerStore.getWorkerInstance(instanceName);
        if (worker) {
            for (const existId of worker.installIds) {
                const managedInstall = this._allInstalls[existId];
                if (managedInstall) {
                    managedInstall.status = InstallStatus.Started;
                    managedInstall.updatedMillisecond = Date.now();
                }
                else {
                    // ghost
                    logger_1.logger.debug(`Ignore ghost instance=${instanceName} id=${existId}`);
                }
            }
        }
    }
    _startSyncing(timeout) {
        // every minutes
        if (!this._syncTimeout) {
            this._syncTimeout = setTimeout(async () => {
                this._syncTimeout = undefined;
                let success = false;
                try {
                    success = await this._syncInstalls();
                }
                catch (e) {
                    logger_1.logger.error(e);
                }
                finally {
                    this._startSyncing(success ? 60 * 1000 : 3 * 1000);
                }
            }, timeout || 0);
        }
    }
    _startHealthCheck() {
        setInterval(async () => {
            try {
                await this._healthCheck();
            }
            catch (e) {
                logger_1.logger.error(e);
            }
        }, 10 * 1000);
    }
    async _syncInstalls(diffOnly = false) {
        let success = false;
        try {
            if (this._syncing || !this.adaptor.isReady) {
                return success;
            }
            this._syncing = true;
            if (diffOnly) {
                await this._checkDiffInstalls();
            }
            else {
                await this._checkAllInstalls();
            }
            await this.synchronize();
            success = true;
        }
        catch (e) {
            console.error(e);
        }
        this._syncing = false;
        return success;
    }
    async _checkAllInstalls() {
        var e_1, _a;
        const startedTime = Date.now();
        logger_1.logger.debug('API Sync Start');
        const installsApi = [];
        try {
            // set current id before getting data
            this._currentAppEventsSequenceNo = await obnizCloudClient_1.obnizCloudClientInstance.getCurrentEventNo(this._appToken, this._obnizSdkOption);
            installsApi.push(...(await obnizCloudClient_1.obnizCloudClientInstance.getListFromObnizCloud(this._appToken, this._obnizSdkOption)));
        }
        catch (e) {
            console.error(e);
            process.exit(-1);
        }
        logger_1.logger.debug(`API Sync Finished Count=${installsApi.length} duration=${Date.now() - startedTime}msec`);
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
            const allNum = Object.keys(this._allInstalls).length +
                mustAdds.length -
                deleted.length;
            logger_1.logger.debug(`all \t| added \t| updated \t| deleted`);
            logger_1.logger.debug(`${allNum} \t| ${mustAdds.length} \t| ${updated.length} \t| ${deleted.length}`);
        }
        const updatePromises = [];
        for (const install of updated) {
            updatePromises.push(this._updateDevice(install.id, install));
        }
        await Promise.all(updatePromises);
        for (const managedInstall of deleted) {
            this._deleteDevice(managedInstall.install.id);
        }
        try {
            for (var mustAdds_1 = __asyncValues(mustAdds), mustAdds_1_1; mustAdds_1_1 = await mustAdds_1.next(), !mustAdds_1_1.done;) {
                const install = mustAdds_1_1.value;
                await this._addDevice(install.id, install);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (mustAdds_1_1 && !mustAdds_1_1.done && (_a = mustAdds_1.return)) await _a.call(mustAdds_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    async _checkDiffInstalls() {
        const startedTime = Date.now();
        logger_1.logger.debug('API Diff Sync Start');
        const events = [];
        try {
            const { maxId, appEvents, } = await obnizCloudClient_1.obnizCloudClientInstance.getDiffListFromObnizCloud(this._appToken, this._obnizSdkOption, this._currentAppEventsSequenceNo);
            events.push(...appEvents);
            this._currentAppEventsSequenceNo = maxId;
        }
        catch (e) {
            console.error(e);
            process.exit(-1);
        }
        logger_1.logger.debug(`API Diff Sync Finished DiffCount=${events.length} duration=${Date.now() - startedTime}msec`);
        if (events.length > 0) {
            const addNum = events.filter((e) => e.type === 'install.create').length;
            const updateNum = events.filter((e) => e.type === 'install.update')
                .length;
            const deleteNum = events.filter((e) => e.type === 'install.delete')
                .length;
            const allNum = Object.keys(this._allInstalls).length + addNum - deleteNum;
            logger_1.logger.debug(`all \t| added \t| updated \t| deleted`);
            logger_1.logger.debug(`${allNum} \t| ${addNum} \t| ${updateNum} \t| ${deleteNum}`);
        }
        const list = {};
        // overwrite newer if device duplicate
        for (const one of events) {
            if (one.payload.device) {
                list[one.payload.device.id] = one;
            }
        }
        for (const key in list) {
            const one = list[key];
            if (one.type === 'install.update' && one.payload.device) {
                this._updateDevice(one.payload.device.id, one.payload.device);
            }
            else if (one.type === 'install.delete' && one.payload.device) {
                this._deleteDevice(one.payload.device.id);
            }
            else if (one.type === 'install.create' && one.payload.device) {
                await this._addDevice(one.payload.device.id, one.payload.device);
            }
        }
    }
    async _addDevice(obnizId, device) {
        if (this._allInstalls[obnizId]) {
            // already exist
            this._updateDevice(obnizId, device);
            return;
        }
        const instance = await this.bestWorkerInstance(); // maybe throw
        const managedInstall = {
            instanceName: instance.name,
            status: InstallStatus.Starting,
            updatedMillisecond: Date.now(),
            install: device,
        };
        this._allInstalls[obnizId] = managedInstall;
    }
    async _updateDevice(obnizId, device) {
        const managedInstall = this._allInstalls[obnizId];
        if (!managedInstall) {
            await this._addDevice(obnizId, device);
            return;
        }
        managedInstall.install = device;
    }
    _deleteDevice(obnizId) {
        if (!this._allInstalls[obnizId]) {
            // not exist
            return;
        }
        this._allInstalls[obnizId].status = InstallStatus.Stopping;
        delete this._allInstalls[obnizId];
    }
    async synchronize() {
        const installsByInstanceName = {};
        for (const instanceName in await this._workerStore.getAllWorkerInstances()) {
            installsByInstanceName[instanceName] = [];
        }
        for (const id in this._allInstalls) {
            const managedInstall = this._allInstalls[id];
            const instanceName = managedInstall.instanceName;
            installsByInstanceName[instanceName].push(managedInstall.install);
        }
        for (const instanceName in installsByInstanceName) {
            logger_1.logger.debug(`synchronize sent to ${instanceName} idsCount=${installsByInstanceName[instanceName].length}`);
            await this.adaptor.synchronize(instanceName, installsByInstanceName[instanceName]);
        }
    }
    async _healthCheck() {
        const current = Date.now();
        // each install
        // for (const id in this._allInstalls) {
        //   const managedInstall = this._allInstalls[id];
        //   if (managedInstall.updatedMillisecond + 60 * 1000 < current) {
        //     // over time.
        //     this._onHealthCheckFailedInstall(managedInstall);
        //   }
        // }
        // Me
        if (this.adaptor instanceof RedisAdaptor_1.RedisAdaptor) {
            // If adaptor is Redis
            const redis = this.adaptor.getRedisInstance();
            await redis.set(`master:${this._instanceName}:heartbeat`, Date.now(), 'EX', 20);
        }
        // Each room
        const instances = await this._workerStore.getAllWorkerInstances();
        for (const [id, instance] of Object.entries(instances)) {
            if (instance.updatedMillisecond + 30 * 1000 < current) {
                // over time.
                this._onHealthCheckFailedWorkerInstance(instance);
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
    async hasSubClusteredInstances() {
        return (Object.keys(await this._workerStore.getAllWorkerInstances()).length > 1);
    }
    async request(key, timeout) {
        const waitingInstanceCount = Object.keys(await this._workerStore.getAllWorkerInstances()).length;
        return new Promise(async (resolve, reject) => {
            try {
                const requestId = `${Date.now()} - ${Math.random()
                    .toString(36)
                    .slice(-8)}`;
                const execute = {
                    requestId,
                    returnedInstanceCount: 0,
                    waitingInstanceCount,
                    results: {},
                    resolve,
                    reject,
                };
                await this.adaptor.keyRequest(key, requestId);
                this._keyRequestExecutes[requestId] = execute;
                await tools_1.wait(timeout);
                if (this._keyRequestExecutes[requestId]) {
                    delete this._keyRequestExecutes[requestId];
                    reject(new Errors_1.ObnizAppTimeoutError('Request timed out.'));
                }
                else {
                    reject(new Errors_1.ObnizAppMasterSlaveCommunicationError('Could not get request data.'));
                }
            }
            catch (e) {
                reject(e);
            }
        });
    }
}
exports.Manager = Manager;
//# sourceMappingURL=Manager.js.map