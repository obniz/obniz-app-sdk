"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const adaptor_1 = __importDefault(require("./adaptor"));
const IORedis = require('ioredis');
const logger_1 = require("../logger");
class RedisAdaptor extends adaptor_1.default {
    constructor(id, isMaster) {
        super();
        this.isMaster = false;
        this.id = id;
        this.isMaster = isMaster;
        this.redis = new IORedis(process.env.REDIS_URL);
        this.pubRedis = new IORedis(process.env.REDIS_URL);
        this.redis.subscribe("app", () => {
        });
        this.redis.on("ready", () => {
            logger_1.logger.debug("ready");
            if (this.isMaster) {
                this.reportRequest().then(() => {
                }).catch(e => {
                    logger_1.logger.error(e);
                });
            }
            else {
                this.onReportRequest().then(() => {
                }).catch(e => {
                    logger_1.logger.error(e);
                });
            }
        });
        this.redis.on("message", (channel, message) => {
            const parsed = JSON.parse(message);
            // slave functions
            if (this.isMaster === parsed.toMaster && this.isMaster === false && (parsed.instanceName === this.id || parsed.instanceName === '*')) {
                if (parsed.action === 'synchronize') {
                    this.onSynchronize(parsed.installs).then(() => {
                    }).catch(e => {
                        logger_1.logger.error(e);
                    });
                }
                else if (parsed.action === 'reportRequest') {
                    this.onReportRequest().then(() => {
                    }).catch(e => {
                        logger_1.logger.error(e);
                    });
                }
                // master functions
            }
            else if (this.isMaster === parsed.toMaster && this.isMaster === true) {
                if (parsed.action === 'report') {
                    this.onReported(parsed.instanceName, parsed.installIds).then(() => {
                    }).catch(e => {
                        logger_1.logger.error(e);
                    });
                }
            }
        });
        this.redis.on("+node", () => {
            logger_1.logger.debug('+node');
        });
        this.redis.on("-node", () => {
            logger_1.logger.debug('-node');
        });
    }
    async send(json) {
        await this.pubRedis.publish("app", JSON.stringify(json));
    }
    async synchronize(instanceName, installs) {
        await this.send({
            action: 'synchronize',
            instanceName,
            toMaster: false,
            installs
        });
    }
    async reportRequest() {
        await this.send({
            action: 'reportRequest',
            instanceName: '*',
            toMaster: false
        });
    }
    async report(instanceName, installIds) {
        await this.send({
            action: 'report',
            instanceName,
            toMaster: true,
            installIds
        });
    }
}
exports.default = RedisAdaptor;
//# sourceMappingURL=redis.js.map