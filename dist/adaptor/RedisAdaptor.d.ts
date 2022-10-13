import { Adaptor, MessageBetweenInstance } from './Adaptor';
import { Redis, RedisOptions } from 'ioredis';
export declare type RedisAdaptorOptions = RedisOptions;
export declare class RedisAdaptor extends Adaptor {
    private _redis;
    private _pubRedis;
    private _subRedis;
    private _isMaster;
    constructor(id: string, isMaster: boolean, redisOption: RedisAdaptorOptions);
    private _onRedisReady;
    private _onRedisMessage;
    private _bindRedisEvents;
    _send(json: MessageBetweenInstance): Promise<void>;
    getRedisInstance(): Redis;
}
