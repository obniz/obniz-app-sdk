"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DummyObniz = void 0;
class DummyObniz {
    constructor(id, options) {
        this.__logs = [];
        this.__autoConnect = false;
        this.id = id;
        this.options = options;
        DummyObniz.obnizes.push(this);
    }
    static __reset() {
        DummyObniz.obnizes = [];
    }
    get autoConnect() {
        return this.__autoConnect;
    }
    set autoConnect(val) {
        this.__logs.push({
            date: new Date(),
            eventType: val ? 'autoConnectOn' : 'autoConnectOff',
        });
        this.__autoConnect = val;
    }
    async closeWait() {
        this.__logs.push({ date: new Date(), eventType: 'close' });
    }
    connect() {
        this.__logs.push({ date: new Date(), eventType: 'connect' });
    }
}
exports.DummyObniz = DummyObniz;
DummyObniz.version = '3.16.0';
DummyObniz.obnizes = [];
//# sourceMappingURL=DummyObniz.js.map