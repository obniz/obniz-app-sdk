import { Adaptor } from './Adaptor';
import { Redis, RedisOptions } from 'ioredis';
import { MessagesUnion } from '../utils/message';
import { AppInstanceType } from '../App';
export type RedisAdaptorOptions = RedisOptions;
export declare class RedisAdaptor extends Adaptor {
    private _redis;
    private _subOnlyRedis;
    private _isManagerHeartbeatInited;
    private _isFirstManager;
    constructor(id: string, instanceType: AppInstanceType, redisOption: RedisAdaptorOptions);
    private _onRedisReady;
    private _onRedisMessage;
    private _onPatternRedisMessage;
    private _bindRedisEvents;
    protected _onSendMessage(data: MessagesUnion): Promise<void>;
    getRedisInstance(): Redis;
    getManagerStatus(): {
        initialized: false;
    } | {
        initialized: true;
        isFirstManager: boolean;
    };
    onManagerHeartbeat(): Promise<void>;
    onSlaveHeartbeat(): Promise<void>;
}
