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
        console.log("loop");
    }
    onEnd() {
    }
    /**
     * obniz lifecycle
     */
    onObnizConnect(obniz) {
    }
    onObnizLoop(obniz) {
        console.log("obniz loop");
    }
    onObnizClose(obniz) {
    }
    async stop() {
    }
}
const app = new index_1.App({
    appToken: 'apptoken_Tmj2JMXVXgLBYW6iDlBzQph7L6uwcBYqRmW2NvnKk_kQeiwvnRCnUJePUrsTRtXW',
    workerClass: MyWorker,
    instanceType: index_1.AppInstanceType.WebAndWorker
});
app.start();
//# sourceMappingURL=testrun.js.map