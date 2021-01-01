"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const adaptor_1 = __importDefault(require("./adaptor"));
const IORedis = require('ioredis');
const logger_1 = require("../logger");
class RedisAdaptor extends adaptor_1.default {
    constructor(id) {
        super();
        this.id = id;
        this.redis = new IORedis(process.env.REDIS_URL);
        this.pubRedis = new IORedis(process.env.REDIS_URL);
        this.redis.subscribe("app", () => {
        });
        this.redis.on("ready", async () => {
            if (this.id !== 'master') {
                await this.pubRedis.publish("app", JSON.stringify({
                    action: 'info',
                    instanceName: 'master',
                    from: this.id
                }));
            }
        });
        this.redis.on("message", (channel, message) => {
            const parsed = JSON.parse(message);
            if (parsed.instanceName === this.id) {
                if (parsed.action === 'start') {
                    this.onStart(parsed.install).then(() => {
                    }).catch(e => {
                        logger_1.logger.error(e);
                    });
                }
                else if (parsed.action === 'update') {
                    this.onUpdate(parsed.install).then(() => {
                    }).catch(e => {
                        logger_1.logger.error(e);
                    });
                }
                else if (parsed.action === 'stop') {
                    this.onStop(parsed.install).then(() => {
                    }).catch(e => {
                        logger_1.logger.error(e);
                    });
                }
                else if (parsed.action === 'info') {
                    this.onInstanceInfoUpdated(parsed);
                }
                else {
                    console.error(`unknown action ${parsed.action}`);
                    process.exit(-1);
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
    async start(install, instanceName) {
        await this.pubRedis.publish("app", JSON.stringify({
            action: 'start',
            instanceName,
            install
        }));
    }
    async update(install, instanceName) {
        await this.pubRedis.publish("app", JSON.stringify({
            action: 'update',
            instanceName,
            install
        }));
    }
    async stop(install, instanceName) {
        await this.pubRedis.publish("app", JSON.stringify({
            action: 'stop',
            instanceName,
            install
        }));
    }
}
exports.default = RedisAdaptor;
//# sourceMappingURL=redis.js.map