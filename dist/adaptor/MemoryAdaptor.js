"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryAdaptor = void 0;
const Adaptor_1 = require("./Adaptor");
const memoryAdaptorList = [];
class MemoryAdaptor extends Adaptor_1.Adaptor {
    constructor(id, isMaster, memoryOption) {
        super(id, isMaster);
        console.log(memoryOption);
        memoryAdaptorList.push(this);
        this._onReady();
    }
    _onRedisReady() {
        this._onReady();
    }
    _onRedisMessage(channel, message) {
        const parsed = JSON.parse(message);
        // slave functions
        this.onMessage(parsed);
    }
    async _send(json) {
        for (const one of memoryAdaptorList) {
            one.onMessage(json);
        }
    }
}
exports.MemoryAdaptor = MemoryAdaptor;
//# sourceMappingURL=MemoryAdaptor.js.map