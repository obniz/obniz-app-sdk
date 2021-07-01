import { Adaptor, MessageBetweenInstance } from './Adaptor';
import IORedis from 'ioredis';
export declare type RedisAdaptorOptions = IORedis.RedisOptions;
export declare class RedisAdaptor extends Adaptor {
    private _redis;
    private _pubRedis;
    constructor(id: string, isMaster: boolean, redisOption: RedisAdaptorOptions);
    private _onRedisReady;
    private _onRedisMessage;
    private _bindRedisEvents;
    _send(json: MessageBetweenInstance): Promise<void>;
}
