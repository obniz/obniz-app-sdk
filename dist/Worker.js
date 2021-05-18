"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Worker = void 0;
const logger_1 = require("./logger");
/**
 * This class is exported from this library
 * "Abstract" must be drop
 * Example: https://qiita.com/okdyy75/items/610623943979cf422775#%E3%81%BE%E3%81%82%E3%81%A8%E3%82%8A%E3%81%82%E3%81%88%E3%81%9A%E3%81%A9%E3%82%93%E3%81%AA%E6%84%9F%E3%81%98%E3%81%AB%E6%9B%B8%E3%81%8F%E3%81%AE
 */
class Worker {
    constructor(install, app, option = {}) {
        this.state = 'stopped';
        this.install = install;
        this.app = app;
        this._obnizOption = option;
        const overrideOptions = {
            auto_connect: false,
        };
        this.obniz = new this.app.obnizClass(this.install.id, Object.assign(Object.assign({}, this._obnizOption), overrideOptions));
        this.obniz.onconnect = this.onObnizConnect.bind(this);
        this.obniz.onloop = this.onObnizLoop.bind(this);
        this.obniz.onclose = this.onObnizClose.bind(this);
        this.user = this.install.user;
    }
    /**
     * Worker lifecycle
     */
    async onStart() { }
    /**
     * This funcion will be called rrepeatedly while App is started.
     */
    async onLoop() { }
    async onEnd() { }
    /**
     *
     * @param key string key that represents what types of reqeust.
     * @returns string for requested key
     */
    async onRequest(key) {
        return '';
    }
    /**
     * obniz lifecycle
     */
    async onObnizConnect(obniz) { }
    async onObnizLoop(obniz) { }
    async onObnizClose(obniz) { }
    async start() {
        if (this.state !== 'stopped') {
            throw new Error(`invalid state`);
        }
        this.state = 'starting';
        await this.onStart();
        this.state = 'started';
        this.obniz.autoConnect = true;
        this.obniz.connect();
        // in background
        // noinspection ES6MissingAwait
        this._loop();
    }
    async _loop() {
        while (this.state === 'starting' || this.state === 'started') {
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
        if (this.state === 'starting' || this.state === 'started') {
            this.state = 'stopping';
            if (this.obniz) {
                try {
                    await this.obniz.closeWait();
                }
                catch (e) {
                    console.error(e); // handle close caused error. and promise onEnd() called
                }
            }
            await this.onEnd();
            this.state = 'stopped';
        }
    }
}
exports.Worker = Worker;
//# sourceMappingURL=Worker.js.map