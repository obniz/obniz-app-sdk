import { Adaptor } from './Adaptor';
import IORedis, { Redis, RedisOptions } from 'ioredis';
import { logger } from '../logger';
import { MessagesUnion } from '../utils/message';
import { AppInstanceType } from '../App';

export type RedisAdaptorOptions = RedisOptions;

export class RedisAdaptor extends Adaptor {
  private _redis: Redis;
  private _subOnlyRedis: Redis;

  constructor(
    id: string,
    instanceType: AppInstanceType,
    redisOption: RedisAdaptorOptions
  ) {
    super(id, instanceType);
    this._redis = new IORedis(redisOption);
    this._subOnlyRedis = new IORedis(redisOption);
    this._bindRedisEvents(this._subOnlyRedis);
  }

  private _onRedisReady() {
    if (this.isMaster) {
      setTimeout(() => {
        this._onReady();
      }, 3 * 1000);
    } else {
      this._onReady();
    }
  }

  private _onRedisMessage(channel: string, message: string) {
    const parsed = JSON.parse(message) as MessagesUnion;
    this.onMessage(parsed);
  }

  private _onPatternRedisMessage(
    pattern: string,
    channel: string,
    message: string
  ) {
    this._onRedisMessage(channel, message);
  }

  private _bindRedisEvents(_redis: Redis) {
    if (this.instanceType === AppInstanceType.Slave) {
      _redis.subscribe('app', `app.${this.id}`);
      _redis.on('message', this._onRedisMessage.bind(this));
    } else {
      _redis.psubscribe('app*');
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

  protected async _onSendMessage(data: MessagesUnion): Promise<void> {
    const channel =
      data.info.sendMode === 'direct'
        ? this.instanceType === AppInstanceType.Slave
          ? `app.${data.info.from}` // m(to) <= (app.{from}) == s(from)
          : `app.${data.info.to}` // m(from) == (app.{to}) => s(to)
        : 'app'; // m(any) <= (app) => s(any)
    await this._redis.publish(channel, JSON.stringify(data));
  }

  getRedisInstance(): Redis {
    return this._redis;
  }
}
