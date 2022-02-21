"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisWorkerStore = void 0;
const WorkerStoreBase_1 = require("./WorkerStoreBase");
class RedisWorkerStore extends WorkerStoreBase_1.WorkerStoreBase {
    constructor(adaptor) {
        super();
        this._redisAdaptor = adaptor;
    }
    getWorkerInstance(instanceName) {
        throw new Error('Method not implemented.');
    }
    getAllWorkerInstance() {
        throw new Error('Method not implemented.');
    }
    addWorkerInstance(instanceName, props) {
        throw new Error('Method not implemented.');
    }
    updateWorkerInstance(instanceName, props) {
        throw new Error('Method not implemented.');
    }
    deleteWorkerInstance(instanceName) {
        throw new Error('Method not implemented.');
    }
}
exports.RedisWorkerStore = RedisWorkerStore;
//# sourceMappingURL=RedisWorkerStore.js.map