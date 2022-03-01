"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryInstallStore = void 0;
const InstallStoreBase_1 = require("./InstallStoreBase");
class MemoryInstallStore extends InstallStoreBase_1.InstallStoreBase {
    constructor(store) {
        super();
        this._installs = {};
        this._workerStore = store;
    }
    get(id) {
        return new Promise((r) => r(this._installs[id]));
    }
    getByWorker(name) {
        const installs = {};
        for (const [id, install] of Object.entries(this._installs)) {
            if (install.instanceName === name)
                installs[id] = install;
        }
        return new Promise((r) => r(installs));
    }
    getAll() {
        return new Promise((r) => r(this._installs));
    }
    async getBestWorkerInstance(exceptInstanceName = []) {
        const installCounts = {};
        const instances = await this._workerStore.getAllWorkerInstances();
        for (const name in instances) {
            installCounts[name] = 0;
        }
        for (const obnizId in this._installs) {
            const managedInstall = this._installs[obnizId];
            if (installCounts[managedInstall.instanceName] === undefined)
                continue;
            installCounts[managedInstall.instanceName] += 1;
        }
        let minNumber = 1000 * 1000;
        let minInstance = null;
        for (const key in installCounts) {
            if (exceptInstanceName.includes(key))
                continue;
            if (installCounts[key] < minNumber) {
                minInstance = instances[key];
                minNumber = installCounts[key];
            }
        }
        return minInstance;
    }
    async autoCreate(id, device) {
        const worker = await this.getBestWorkerInstance();
        if (!worker)
            throw new Error('NO_AVAILABLE_WORKER');
        return this.manualCreate(id, {
            instanceName: worker.name,
            install: device,
            status: InstallStoreBase_1.InstallStatus.Starting,
            updatedMillisecond: Date.now(),
        });
    }
    manualCreate(id, install) {
        this._installs[id] = install;
        return new Promise((r) => r(this._installs[id]));
    }
    async autoRelocate(id, force = false) {
        const nowInstall = await this.get(id);
        if (!nowInstall)
            throw new Error('INSTALL_NOT_FOUND');
        const worker = await this.getBestWorkerInstance([nowInstall.instanceName]);
        if (!worker)
            throw new Error('NO_AVAILABLE_WORKER');
        return this.update(id, {
            instanceName: worker.name,
            status: InstallStoreBase_1.InstallStatus.Starting,
        });
    }
    update(id, props) {
        var _a, _b, _c, _d;
        this._installs[id] = {
            install: (_a = props.install) !== null && _a !== void 0 ? _a : this._installs[id].install,
            instanceName: (_b = props.instanceName) !== null && _b !== void 0 ? _b : this._installs[id].instanceName,
            status: (_c = props.status) !== null && _c !== void 0 ? _c : this._installs[id].status,
            updatedMillisecond: (_d = props.updatedMillisecond) !== null && _d !== void 0 ? _d : this._installs[id].updatedMillisecond,
        };
        return new Promise((r) => r(this._installs[id]));
    }
    remove(id) {
        delete this._installs[id];
        return new Promise((r) => r());
    }
}
exports.MemoryInstallStore = MemoryInstallStore;
//# sourceMappingURL=MemoryInstallStore.js.map