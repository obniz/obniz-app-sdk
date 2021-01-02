"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
class MyWorker extends index_1.Worker {
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
const app = new index_1.App({
    appToken: "",
    workerClass: MyWorker,
    instanceType: index_1.AppInstanceType.Web
});
app.start();
//# sourceMappingURL=testrun.js.map