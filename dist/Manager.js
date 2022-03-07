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
const ObnizCloudClient_1 = require("./ObnizCloudClient");
const express_1 = __importDefault(require("express"));
const AdaptorFactory_1 = require("./adaptor/AdaptorFactory");
const tools_1 = require("./tools");
const Errors_1 = require("./Errors");
const MemoryWorkerStore_1 = require("./worker_store/MemoryWorkerStore");
const RedisAdaptor_1 = require("./adaptor/RedisAdaptor");
const RedisWorkerStore_1 = require("./worker_store/RedisWorkerStore");
const RedisInstallStore_1 = require("./install_store/RedisInstallStore");
const MemoryInstallStore_1 = require("./install_store/MemoryInstallStore");
const fast_equals_1 = require("fast-equals");
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
        // Note: moved to _installStore
        // private _allInstalls: { [key: string]: ManagedInstall } = {};
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
            if (!(this._workerStore instanceof MemoryWorkerStore_1.MemoryWorkerStore))
                return;
            const exist = await this._workerStore.getWorkerInstance(reportInstanceName);
            if (exist) {
                this._workerStore.updateWorkerInstance(reportInstanceName, {
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
            this._installStore = new RedisInstallStore_1.RedisInstallStore(this.adaptor);
        }
        else {
            const workerStore = new MemoryWorkerStore_1.MemoryWorkerStore();
            this._workerStore = workerStore;
            this._installStore = new MemoryInstallStore_1.MemoryInstallStore(workerStore);
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
        var e_1, _a;
        logger_1.logger.info(`worker lost ${instanceName}`);
        // delete immediately
        const diedWorker = await this._workerStore.getWorkerInstance(instanceName);
        if (!diedWorker)
            throw new Error('Failed get diedWorker status');
        // Replacing missed instance workers.
        const missedInstalls = await this._installStore.getByWorker(diedWorker.name);
        try {
            for (var _b = __asyncValues(Object.keys(missedInstalls)), _c; _c = await _b.next(), !_c.done;) {
                const install = _c.value;
                const instance = await this._installStore.autoRelocate(install, false);
                if (!instance)
                    logger_1.logger.info(`${install} already moved available worker.`);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) await _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        await this._workerStore.deleteWorkerInstance(instanceName);
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
                const managedInstall = await this._installStore.get(existId);
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
        var e_2, _a, e_3, _b, e_4, _c;
        const startedTime = Date.now();
        logger_1.logger.debug('API Sync Start');
        const installsApi = [];
        try {
            // set current id before getting data
            this._currentAppEventsSequenceNo = await ObnizCloudClient_1.obnizCloudClientInstance.getCurrentEventNo(this._appToken, this._obnizSdkOption);
            installsApi.push(...(await ObnizCloudClient_1.obnizCloudClientInstance.getListFromObnizCloud(this._appToken, this._obnizSdkOption)));
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
        const ids = installsApi.map((d) => d.id);
        const devices = await this._installStore.getMany(ids);
        for (const device of installsApi) {
            const install = devices[device.id];
            if (!install) {
                mustAdds.push(device);
            }
            else {
                if (!fast_equals_1.deepEqual(device, install.install))
                    updated.push(device);
            }
        }
        const installs = await this._installStore.getAll();
        for (const id in installs) {
            let found = false;
            for (const install of installsApi) {
                if (id === install.id) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                deleted.push(installs[id]);
            }
        }
        if (mustAdds.length + updated.length + deleted.length > 0) {
            const allNum = Object.keys(installs).length + mustAdds.length - deleted.length;
            logger_1.logger.debug(`all \t| added \t| updated \t| deleted`);
            logger_1.logger.debug(`${allNum} \t| ${mustAdds.length} \t| ${updated.length} \t| ${deleted.length}`);
        }
        try {
            for (var updated_1 = __asyncValues(updated), updated_1_1; updated_1_1 = await updated_1.next(), !updated_1_1.done;) {
                const updDevice = updated_1_1.value;
                await this._updateDevice(updDevice.id, updDevice);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (updated_1_1 && !updated_1_1.done && (_a = updated_1.return)) await _a.call(updated_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        try {
            for (var deleted_1 = __asyncValues(deleted), deleted_1_1; deleted_1_1 = await deleted_1.next(), !deleted_1_1.done;) {
                const delInstall = deleted_1_1.value;
                await this._deleteDevice(delInstall.install.id);
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (deleted_1_1 && !deleted_1_1.done && (_b = deleted_1.return)) await _b.call(deleted_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        try {
            for (var mustAdds_1 = __asyncValues(mustAdds), mustAdds_1_1; mustAdds_1_1 = await mustAdds_1.next(), !mustAdds_1_1.done;) {
                const addDevice = mustAdds_1_1.value;
                await this._addDevice(addDevice.id, addDevice);
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (mustAdds_1_1 && !mustAdds_1_1.done && (_c = mustAdds_1.return)) await _c.call(mustAdds_1);
            }
            finally { if (e_4) throw e_4.error; }
        }
    }
    async _checkDiffInstalls() {
        var e_5, _a;
        const startedTime = Date.now();
        logger_1.logger.debug('API Diff Sync Start');
        const events = [];
        try {
            const { maxId, appEvents, } = await ObnizCloudClient_1.obnizCloudClientInstance.getDiffListFromObnizCloud(this._appToken, this._obnizSdkOption, this._currentAppEventsSequenceNo);
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
            const allNum = Object.keys(await this._installStore.getAll()).length +
                addNum -
                deleteNum;
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
        try {
            for (var _b = __asyncValues(Object.keys(list)), _c; _c = await _b.next(), !_c.done;) {
                const key = _c.value;
                const one = list[key];
                if (one.type === 'install.update' && one.payload.device) {
                    this._updateDevice(one.payload.device.id, one.payload.device);
                }
                else if (one.type === 'install.delete' && one.payload.device) {
                    await this._deleteDevice(one.payload.device.id);
                }
                else if (one.type === 'install.create' && one.payload.device) {
                    await this._addDevice(one.payload.device.id, one.payload.device);
                }
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) await _a.call(_b);
            }
            finally { if (e_5) throw e_5.error; }
        }
    }
    async _addDevice(obnizId, device) {
        const createdInstall = await this._installStore.autoCreate(obnizId, device);
        return createdInstall;
    }
    async _updateDevice(obnizId, device) {
        const install = await this._installStore.get(obnizId);
        if (!install) {
            const createdInstall = await this._installStore.autoCreate(obnizId, device);
            return createdInstall;
        }
        const updatedInstall = await this._installStore.update(obnizId, {
            install: device,
        });
        return updatedInstall;
    }
    async _deleteDevice(obnizId) {
        await this._installStore.remove(obnizId);
    }
    async synchronize() {
        var e_6, _a, e_7, _b;
        const installsByInstanceName = {};
        const instances = await this._workerStore.getAllWorkerInstances();
        const instanceKeys = Object.keys(instances);
        if (this.adaptor instanceof RedisAdaptor_1.RedisAdaptor) {
            try {
                for (var instanceKeys_1 = __asyncValues(instanceKeys), instanceKeys_1_1; instanceKeys_1_1 = await instanceKeys_1.next(), !instanceKeys_1_1.done;) {
                    const instanceName = instanceKeys_1_1.value;
                    logger_1.logger.debug(`synchronize sent to ${instanceName} via Redis`);
                    await this.adaptor.synchronize(instanceName, 'redisList');
                }
            }
            catch (e_6_1) { e_6 = { error: e_6_1 }; }
            finally {
                try {
                    if (instanceKeys_1_1 && !instanceKeys_1_1.done && (_a = instanceKeys_1.return)) await _a.call(instanceKeys_1);
                }
                finally { if (e_6) throw e_6.error; }
            }
        }
        else {
            for (const instanceName in instances) {
                installsByInstanceName[instanceName] = [];
            }
            const installs = await this._installStore.getAll();
            for (const id in installs) {
                const managedInstall = installs[id];
                const instanceName = managedInstall.instanceName;
                installsByInstanceName[instanceName].push(managedInstall.install);
            }
            try {
                for (var instanceKeys_2 = __asyncValues(instanceKeys), instanceKeys_2_1; instanceKeys_2_1 = await instanceKeys_2.next(), !instanceKeys_2_1.done;) {
                    const instanceName = instanceKeys_2_1.value;
                    logger_1.logger.debug(`synchronize sent to ${instanceName} idsCount=${installsByInstanceName[instanceName].length}`);
                    await this.adaptor.synchronize(instanceName, 'attachList', installsByInstanceName[instanceName]);
                }
            }
            catch (e_7_1) { e_7 = { error: e_7_1 }; }
            finally {
                try {
                    if (instanceKeys_2_1 && !instanceKeys_2_1.done && (_b = instanceKeys_2.return)) await _b.call(instanceKeys_2);
                }
                finally { if (e_7) throw e_7.error; }
            }
        }
    }
    async _healthCheck() {
        const current = Date.now();
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