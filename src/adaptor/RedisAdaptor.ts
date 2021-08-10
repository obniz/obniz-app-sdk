import { Adaptor, MessageBetweenInstance } from './Adaptor';
import IORedis from 'ioredis';
import { logger } from '../logger';

export type RedisAdaptorOptions = IORedis.RedisOptions;

export class RedisAdaptor extends Adaptor {
  private _redis: IORedis.Redis;
  private _pubRedis: IORedis.Redis;

  constructor(id: string, isMaster: boolean, redisOption: RedisAdaptorOptions) {
    super(id, isMaster);
    this._redis = new IORedis(redisOption);
    this._pubRedis = new IORedis(redisOption);
    this._bindRedisEvents(this._redis);
  }

  private _onRedisReady() {
    this._onReady();
  }

  private _onRedisMessage(channel: string, message: string) {
    const parsed = JSON.parse(message) as MessageBetweenInstance;
    // slave functions
    this.onMessage(parsed);
  }

  private _bindRedisEvents(redis: IORedis.Redis) {
    this._redis.subscribe('app', () => {});
    redis.on('ready', this._onRedisReady.bind(this));
    redis.on('message', this._onRedisMessage.bind(this));
    redis.on('+node', () => {
      logger.debug('+node');
    });
    redis.on('-node', () => {
      logger.debug('-node');
    });
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async _send(json: MessageBetweenInstance): Promise<void> {
    await this._pubRedis.publish('app', JSON.stringify(json));
  }
}
