"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisAdaptor = void 0;
const Adaptor_1 = require("./Adaptor");
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../logger");
const App_1 = require("../App");
class RedisAdaptor extends Adaptor_1.Adaptor {
    constructor(id, instanceType, redisOption) {
        super(id, instanceType);
        this._isManagerHeartbeatInited = false;
        this._isFirstManager = false;
        this._redis = new ioredis_1.default(redisOption);
        this._subOnlyRedis = new ioredis_1.default(redisOption);
        this._bindRedisEvents(this._subOnlyRedis);
    }
    _onRedisReady() {
        if (this.instanceType === App_1.AppInstanceType.Master ||
            this.instanceType === App_1.AppInstanceType.Manager) {
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
        this.onMessage(parsed);
    }
    _onPatternRedisMessage(pattern, channel, message) {
        this._onRedisMessage(channel, message);
    }
    _bindRedisEvents(_redis) {
        if (this.instanceType === App_1.AppInstanceType.Slave) {
            _redis.subscribe('app', `app.${this.id}`);
            _redis.on('message', this._onRedisMessage.bind(this));
        }
        else {
            _redis.psubscribe('app*');
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
    async _onSendMessage(data) {
        const channel = data.info.sendMode === 'direct'
            ? this.instanceType === App_1.AppInstanceType.Slave
                ? `app.${data.info.from}` // m(to) <= (app.{from}) == s(from)
                : `app.${data.info.to}` // m(from) == (app.{to}) => s(to)
            : 'app'; // m(any) <= (app) => s(any)
        await this._redis.publish(channel, JSON.stringify(data));
    }
    getRedisInstance() {
        return this._redis;
    }
    getManagerStatus() {
        if (!this._isManagerHeartbeatInited) {
            return {
                initialized: false,
            };
        }
        return {
            initialized: true,
            isFirstManager: this._isFirstManager,
        };
    }
    async onManagerHeartbeat() {
        const redis = this.getRedisInstance();
        if (this._isManagerHeartbeatInited) {
            await redis.set(`master:${this.id}:heartbeat`, Date.now(), 'EX', 20);
        }
        else {
            const res = (await redis.eval(`redis.replicate_commands()local a=redis.call('KEYS','master:*:heartbeat')local b=redis.call('SET','master:'..KEYS[1]..':heartbeat',redis.call('TIME')[1],'EX',20)if not b=='OK'then return{err='FAILED_ADD_MANAGER_HEARTBEAT'}end;return{#a==0 and'true'or'false'}`, 1, this.id));
            this._isManagerHeartbeatInited = true;
            this._isFirstManager = true;
        }
    }
    async onSlaveHeartbeat() {
        const redis = this.getRedisInstance();
        await redis.set(`slave:${this.id}:heartbeat`, Date.now(), 'EX', 20);
    }
}
exports.RedisAdaptor = RedisAdaptor;
//# sourceMappingURL=RedisAdaptor.js.map