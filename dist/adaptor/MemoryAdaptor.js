"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryAdaptor = void 0;
const Adaptor_1 = require("./Adaptor");
class MemoryAdaptor extends Adaptor_1.Adaptor {
    constructor(id, isMaster, memoryOption) {
        super(id, isMaster);
        MemoryAdaptor.memoryAdaptorList.push(this);
        this._onReady();
    }
    async _send(json) {
        for (const one of MemoryAdaptor.memoryAdaptorList) {
            one.onMessage(json);
        }
    }
}
exports.MemoryAdaptor = MemoryAdaptor;
MemoryAdaptor.memoryAdaptorList = [];
//# sourceMappingURL=MemoryAdaptor.js.map