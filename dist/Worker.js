"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Worker = void 0;
const logger_1 = require("./logger");
const obniz_cloud_sdk_1 = require("obniz-cloud-sdk");
/**
 * This class is exported from this library
 * "Abstract" must be drop
 * Example: https://qiita.com/okdyy75/items/610623943979cf422775#%E3%81%BE%E3%81%82%E3%81%A8%E3%82%8A%E3%81%82%E3%81%88%E3%81%9A%E3%81%A9%E3%82%93%E3%81%AA%E6%84%9F%E3%81%98%E3%81%AB%E6%9B%B8%E3%81%8F%E3%81%AE
 */
class Worker {
    constructor(install, app, option = {}) {
        this.state = 'stopped';
        this.cloudLog = {
            info: (message) => {
                this.addLogQueue('info', message);
            },
            error: (message) => {
                this.addLogQueue('error', message);
            },
        };
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.user = this.install.user;
        this._cloudSdk = this._obnizOption.access_token
            ? (0, obniz_cloud_sdk_1.getSdk)(this._obnizOption.access_token, app._options.obnizCloudSdkOption)
            : null;
    }
    /**
     * Worker lifecycle
     */
    /**
     * Called When newaly Installed
     * This will be called before onStart after instantiated.
     * Introduces from v1.4.0
     */
    async onInstall() { }
    /**
     * Called When Uninstalled
     * This will be called before onEnd()
     * Introduces from v1.4.0
     */
    async onUnInstall() { }
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
    /**
     * Start Application by recofnizing Install/Update
     * @param onInstall if start reason is new install then true;
     */
    async start(onInstall = false) {
        if (this.state !== 'stopped') {
            throw new Error(`invalid state`);
        }
        this.state = 'starting';
        if (onInstall) {
            await this.onInstall();
        }
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
    async statusUpdateWait(status, text) {
        if (!this._cloudSdk) {
            return;
        }
        await this._cloudSdk.createAppStatus({
            createAppStatusInput: {
                obniz: {
                    id: this.obniz.id,
                },
                result: {
                    status,
                    text,
                },
            },
        });
    }
    addLogQueue(level, message) {
        if (!this._cloudSdk) {
            return;
        }
        message = '' + message;
        this._cloudSdk
            .createAppLog({
            createAppLogInput: {
                obniz: {
                    id: this.obniz.id,
                },
                app: {
                    logJson: JSON.stringify({ message }),
                    level,
                },
            },
        })
            .catch((e) => {
            console.warn(`failed to send log ${message}`);
        });
    }
}
exports.Worker = Worker;
//# sourceMappingURL=Worker.js.map