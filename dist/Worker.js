"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Worker = void 0;
const obniz_1 = __importDefault(require("obniz"));
const logger_1 = require("./logger");
/**
 * This class is exported from this library
 * "Abstract" must be drop
 * Example: https://qiita.com/okdyy75/items/610623943979cf422775#%E3%81%BE%E3%81%82%E3%81%A8%E3%82%8A%E3%81%82%E3%81%88%E3%81%9A%E3%81%A9%E3%82%93%E3%81%AA%E6%84%9F%E3%81%98%E3%81%AB%E6%9B%B8%E3%81%8F%E3%81%AE
 */
class Worker {
    constructor(install, app, option = {}) {
        this.state = "stopped";
        this.install = install;
        this.app = app;
        this._obnizOption = option;
    }
    /**
     * Worker lifecycle
     */
    async onStart() {
    }
    async onLoop() {
    }
    async onEnd() {
    }
    /**
     * obniz lifecycle
     */
    async onObnizConnect(obniz) {
    }
    async onObnizLoop(obniz) {
    }
    async onObnizClose(obniz) {
    }
    async start() {
        if (this.state !== "stopped") {
            throw new Error(`invalid state`);
        }
        this.state = "starting";
        await this.onStart();
        this.obniz = new obniz_1.default(this.install.id, this._obnizOption);
        this.obniz.onconnect = this.onObnizConnect.bind(this);
        this.obniz.onloop = this.onObnizLoop.bind(this);
        this.obniz.onclose = this.onObnizClose.bind(this);
        this.state = "started";
        // in background
        // noinspection ES6MissingAwait
        this._loop();
    }
    async _loop() {
        while (this.state === "starting" || this.state === "started") {
            try {
                await this.onLoop();
            }
            catch (e) {
                logger_1.logger.error(e);
            }
            await new Promise((resolve) => {
                setTimeout(resolve, 1000);
            });
        }
    }
    async stop() {
        if (this.state === "starting" || this.state === "started") {
            this.state = "stopping";
            if (this.obniz) {
                this.obniz.close(); //todo: change to closeWait
            }
            this.obniz = undefined;
            await this.onEnd();
            this.state = "stopped";
        }
    }
}
exports.Worker = Worker;
//# sourceMappingURL=Worker.js.map