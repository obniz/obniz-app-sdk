import { Adaptor } from './Adaptor';
import { Redis, RedisOptions } from 'ioredis';
import { MessagesUnion } from '../utils/message';
export declare type RedisAdaptorOptions = RedisOptions;
export declare class RedisAdaptor extends Adaptor {
    private _redis;
    private _subOnlyRedis;
    private _isMaster;
    constructor(id: string, isMaster: boolean, redisOption: RedisAdaptorOptions);
    private _onRedisReady;
    private _onRedisMessage;
    private _onPatternRedisMessage;
    private _bindRedisEvents;
    protected _sendMessage(data: MessagesUnion): Promise<void>;
    getRedisInstance(): Redis;
}
