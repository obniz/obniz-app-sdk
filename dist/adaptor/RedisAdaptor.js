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
        this._subOnlyRedis = new ioredis_1.default(redisOption);
        this._bindRedisEvents(this._subOnlyRedis);
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
        // slave functions
        this.onMessage(parsed);
    }
    _onPatternRedisMessage(pattern, channel, message) {
        const parsed = JSON.parse(message);
        // slave functions
        this.onMessage(parsed);
    }
    _bindRedisEvents(_redis) {
        if (this.isMaster) {
            _redis.psubscribe('app?');
            _redis.on('message', this._onRedisMessage.bind(this));
        }
        else {
            _redis.subscribe('app', `app.${this.id}`);
            _redis.on('pmessage', this._onPatternRedisMessage.bind(this));
        }
        _redis.on('ready', this._onRedisReady.bind(this));
        _redis.on('+node', () => {
            logger_1.logger.debug('+node');
        });
        _redis.on('-node', () => {
            logger_1.logger.debug('-node');
        });
    }
    async _sendMessage(data) {
        const channel = data.info.sendMode === 'direct' ? `app.${data.info.instanceName}` : 'app';
        await this._redis.publish(channel, JSON.stringify(data));
    }
    getRedisInstance() {
        return this._redis;
    }
}
exports.RedisAdaptor = RedisAdaptor;
//# sourceMappingURL=RedisAdaptor.js.map