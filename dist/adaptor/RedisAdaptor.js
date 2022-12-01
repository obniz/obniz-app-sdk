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
        super(id, isMaster);
        this._isMaster = isMaster;
        this._redis = new ioredis_1.default(redisOption);
        this._pubRedis = new ioredis_1.default(redisOption);
        this._bindRedisEvents(this._redis);
        console.log('redis worker init');
    }
    _onRedisReady() {
        if (this._isMaster) {
            setTimeout(() => {
                this._onReady();
            }, 3 * 1000);
        }
        else {
            this._onReady();
        }
    }
    _onRedisMessage(channel, message) {
        const parsed = JSON.parse(message);
        console.log('on redis message', message);
        // slave functions
        this.onMessage(parsed);
    }
    _bindRedisEvents(redis) {
        this._redis.subscribe('app', () => { });
        redis.on('ready', this._onRedisReady.bind(this));
        redis.on('message', this._onRedisMessage.bind(this));
        redis.on('+node', () => {
            logger_1.logger.debug('+node');
        });
        redis.on('-node', () => {
            logger_1.logger.debug('-node');
        });
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async _send(json) {
        console.log('pub redis', json);
        await this._pubRedis.publish('app', JSON.stringify(json));
    }
}
exports.RedisAdaptor = RedisAdaptor;
//# sourceMappingURL=RedisAdaptor.js.map