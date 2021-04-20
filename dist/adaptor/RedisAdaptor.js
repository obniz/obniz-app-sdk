"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisAdaptor = void 0;
const Adaptor_1 = require("./Adaptor");
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../logger");
class RedisAdaptor extends Adaptor_1.Adaptor {
    constructor(id, isMaster, redisOption) {
        super();
        this.isMaster = false;
        this.id = id;
        this.isMaster = isMaster;
        this._redis = new ioredis_1.default(redisOption);
        this._pubRedis = new ioredis_1.default(redisOption);
        console.log(redisOption);
        this._redis.subscribe('app', () => { });
        this._redis.on('ready', () => {
            logger_1.logger.debug('ready');
            if (this.isMaster) {
                this.reportRequest()
                    .then(() => { })
                    .catch((e) => {
                    logger_1.logger.error(e);
                });
            }
            else {
                if (this.onReportRequest) {
                    this.onReportRequest()
                        .then(() => { })
                        .catch((e) => {
                        logger_1.logger.error(e);
                    });
                }
            }
        });
        this._redis.on('message', (channel, message) => {
            const parsed = JSON.parse(message);
            // slave functions
            if (this.isMaster === parsed.toMaster &&
                this.isMaster === false &&
                (parsed.instanceName === this.id || parsed.instanceName === '*')) {
                if (parsed.action === 'synchronize') {
                    if (this.onSynchronize) {
                        this.onSynchronize(parsed.installs)
                            .then(() => { })
                            .catch((e) => {
                            logger_1.logger.error(e);
                        });
                    }
                }
                else if (parsed.action === 'reportRequest') {
                    if (this.onReportRequest) {
                        this.onReportRequest()
                            .then(() => { })
                            .catch((e) => {
                            logger_1.logger.error(e);
                        });
                    }
                }
                // master functions
            }
            else if (this.isMaster === parsed.toMaster && this.isMaster === true) {
                if (parsed.action === 'report') {
                    if (this.onReported) {
                        this.onReported(parsed.instanceName, parsed.installIds)
                            .then(() => { })
                            .catch((e) => {
                            logger_1.logger.error(e);
                        });
                    }
                }
            }
        });
        this._redis.on('+node', () => {
            logger_1.logger.debug('+node');
        });
        this._redis.on('-node', () => {
            logger_1.logger.debug('-node');
        });
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async send(json) {
        await this._pubRedis.publish('app', JSON.stringify(json));
    }
    async synchronize(instanceName, installs) {
        await this.send({
            action: 'synchronize',
            instanceName,
            toMaster: false,
            installs,
        });
    }
    async reportRequest() {
        await this.send({
            action: 'reportRequest',
            instanceName: '*',
            toMaster: false,
        });
    }
    async report(instanceName, installIds) {
        await this.send({
            action: 'report',
            instanceName,
            toMaster: true,
            installIds,
        });
    }
}
exports.RedisAdaptor = RedisAdaptor;
//# sourceMappingURL=RedisAdaptor.js.map