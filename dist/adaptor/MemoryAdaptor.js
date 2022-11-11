"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryAdaptor = void 0;
const Adaptor_1 = require("./Adaptor");
class MemoryAdaptor extends Adaptor_1.Adaptor {
    constructor(id, instanceType, memoryOption) {
        super(id, instanceType);
        MemoryAdaptor.memoryAdaptorList.push(this);
        this._onReady();
    }
    async _onSendMessage(data) {
        for (const one of MemoryAdaptor.memoryAdaptorList) {
            one.onMessage(data);
        }
    }
}
exports.MemoryAdaptor = MemoryAdaptor;
MemoryAdaptor.memoryAdaptorList = [];
//# sourceMappingURL=MemoryAdaptor.js.map