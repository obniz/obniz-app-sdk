"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogWorker = void 0;
const Worker_1 = require("../../Worker");
class LogWorker extends Worker_1.Worker {
    constructor(install, app, option = {}) {
        super(install, app, option);
        this.__logs = [];
        this.__addedObnizLoopEvent = false;
        this.__addedLoopEvent = false;
        LogWorker.workers.push(this);
    }
    static __reset() {
        LogWorker.workers = [];
    }
    async onStart() {
        this.__addedLoopEvent = false;
        this.__addLog('onStart');
    }
    async onLoop() {
        if (!this.__addedLoopEvent) {
            this.__addedLoopEvent = true;
            this.__addLog('onLoop');
        }
    }
    async onEnd() {
        this.__addLog('onEnd');
        LogWorker.workers = LogWorker.workers.filter((e) => e !== this);
    }
    async onRequest(key) {
        this.__addLog('onObnizClose');
        return `response from ${this.obniz}`;
    }
    async onObnizConnect(obniz) {
        this.__addedObnizLoopEvent = false;
        this.__addLog('onObnizConnect');
    }
    async onObnizLoop(obniz) {
        if (!this.__addedObnizLoopEvent) {
            this.__addedObnizLoopEvent = true;
            this.__addLog('onObnizLoop');
        }
    }
    async onObnizClose(obniz) {
        this.__addLog('onObnizClose');
    }
    __addLog(eventType, requestVal) {
        this.__logs.push({
            date: new Date(),
            eventType,
            obnizId: this.obniz.id,
            requestVal,
        });
    }
}
exports.LogWorker = LogWorker;
LogWorker.workers = [];
//# sourceMappingURL=LogWorker.js.map