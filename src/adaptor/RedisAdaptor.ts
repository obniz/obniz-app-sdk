import { Adaptor } from './Adaptor';
import IORedis, { Redis, RedisOptions } from 'ioredis';
import { logger } from '../logger';
import { MessagesUnion } from '../utils/message';

export type RedisAdaptorOptions = RedisOptions;

export class RedisAdaptor extends Adaptor {
  private _redis: Redis;
  private _subOnlyRedis: Redis;
  private _isMaster: boolean;

  constructor(id: string, isMaster: boolean, redisOption: RedisAdaptorOptions) {
    super(id, isMaster);
    this._isMaster = isMaster;
    this._redis = new IORedis(redisOption);
    this._subOnlyRedis = new IORedis(redisOption);
    this._bindRedisEvents(this._subOnlyRedis);
  }

  private _onRedisReady() {
    if (this._isMaster) {
      setTimeout(() => {
        this._onReady();
      }, 3 * 1000);
    } else {
      this._onReady();
    }
  }

  private _onRedisMessage(channel: string, message: string) {
    const parsed = JSON.parse(message) as MessagesUnion;
    // slave functions
    this.onMessage(parsed);
  }

  private _onPatternRedisMessage(
    pattern: string,
    channel: string,
    message: string
  ) {
    const parsed = JSON.parse(message) as MessagesUnion;
    // slave functions
    this.onMessage(parsed);
  }

  private _bindRedisEvents(_redis: Redis) {
    if (this.isMaster) {
      _redis.psubscribe('app?');
      _redis.on('message', this._onRedisMessage.bind(this));
    } else {
      _redis.subscribe('app', `app.${this.id}`);
      _redis.on('pmessage', this._onPatternRedisMessage.bind(this));
    }
    _redis.on('ready', this._onRedisReady.bind(this));
    _redis.on('+node', () => {
      logger.debug('+node');
    });
    _redis.on('-node', () => {
      logger.debug('-node');
    });
  }

  protected async _sendMessage(data: MessagesUnion): Promise<void> {
    const channel =
      data.info.sendMode === 'direct' ? `app.${data.info.instanceName}` : 'app';
    await this._redis.publish(channel, JSON.stringify(data));
  }

  getRedisInstance(): Redis {
    return this._redis;
  }
}
