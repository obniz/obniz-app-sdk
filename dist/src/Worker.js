"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Worker = void 0;
class Worker {
    constructor(install, app) {
        this.install = install;
        this.app = app;
    }
    /**
     * Worker lifecycle
     */
    onStart() {
    }
    onLoop() {
    }
    onEnd() {
    }
    /**
     * obniz lifecycle
     */
    onObnizConnect(obniz) {
    }
    onObnizLoop(obniz) {
    }
    onObnizClose(obniz) {
    }
    async stop() {
    }
}
exports.Worker = Worker;
//# sourceMappingURL=Worker.js.map