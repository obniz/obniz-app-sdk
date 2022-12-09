"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryWorkerStore = void 0;
const WorkerStoreBase_1 = require("./WorkerStoreBase");
class MemoryWorkerStore extends WorkerStoreBase_1.WorkerStoreBase {
    constructor() {
        super(...arguments);
        this._workerInstances = {};
    }
    getWorkerInstance(instanceName) {
        const workerInstance = this._workerInstances[instanceName];
        return new Promise((r) => r(workerInstance));
    }
    getAllWorkerInstances() {
        const workerInstances = this._workerInstances;
        return new Promise((r) => r(workerInstances));
    }
    addWorkerInstance(instanceName, props) {
        this._workerInstances[instanceName] = {
            name: instanceName,
            installIds: props.installIds,
            updatedMillisecond: props.updatedMillisecond,
        };
        return this._workerInstances[instanceName];
    }
    updateWorkerInstance(instanceName, props) {
        var _a, _b;
        this._workerInstances[instanceName] = {
            name: instanceName,
            installIds: (_a = props.installIds) !== null && _a !== void 0 ? _a : this._workerInstances[instanceName].installIds,
            updatedMillisecond: (_b = props.updatedMillisecond) !== null && _b !== void 0 ? _b : this._workerInstances[instanceName].updatedMillisecond,
        };
        return this._workerInstances[instanceName];
    }
    deleteWorkerInstance(instanceName) {
        delete this._workerInstances[instanceName];
        return new Promise((r) => r());
    }
}
exports.MemoryWorkerStore = MemoryWorkerStore;
//# sourceMappingURL=MemoryWorkerStore.js.map