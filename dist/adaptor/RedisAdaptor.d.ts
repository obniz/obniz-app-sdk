import { Adaptor } from './Adaptor';
import { Redis, RedisOptions } from 'ioredis';
import { MessagesUnion } from '../utils/message';
import { AppInstanceType } from '../App';
export declare type RedisAdaptorOptions = RedisOptions;
export declare class RedisAdaptor extends Adaptor {
    private _redis;
    private _subOnlyRedis;
    constructor(id: string, instanceType: AppInstanceType, redisOption: RedisAdaptorOptions);
    private _onRedisReady;
    private _onRedisMessage;
    private _onPatternRedisMessage;
    private _bindRedisEvents;
    protected _onSendMessage(data: MessagesUnion): Promise<void>;
    getRedisInstance(): Redis;
}
