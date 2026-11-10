import { Adaptor } from './Adaptor';
import IORedis, { Redis, RedisOptions } from 'ioredis';
import { logger } from '../logger';
import { MessagesUnion } from '../utils/message';
import { AppInstanceType } from '../App';

export type RedisAdaptorOptions = RedisOptions;

export class RedisAdaptor extends Adaptor {
  private _redis: Redis;
  private _subOnlyRedis: Redis;
  private _isManagerHeartbeatInited = false;
  private _isFirstManager = false;
  private _managerProcessing = false;
  private _slaveProcessing = false;

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
    if (
      this.instanceType === AppInstanceType.Master ||
      this.instanceType === AppInstanceType.Manager
    ) {
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
    if (this.isShutdown) return;
    let channel: string;
    if (data.info.sendMode === 'direct') {
      if (this.instanceType === AppInstanceType.Slave && data.info.toManager) {
        // slave → manager: publish on the sender's channel so any
        // pattern-subscribed manager (psubscribe `app*`) receives it.
        // m(to) <= (app.{from}) == s(from)
        channel = `app.${data.info.from}`;
      } else {
        // manager → slave, or slave → slave, or manager → manager:
        // publish on the recipient's channel.
        // m(from) == (app.{to}) => s(to)
        channel = `app.${data.info.to}`;
      }
    } else {
      channel = 'app'; // m(any) <= (app) => s(any)
    }
    await this._redis.publish(channel, JSON.stringify(data));
  }

  getRedisInstance(): Redis {
    return this._redis;
  }

  public async getSlaveInstanceCount(): Promise<number> {
    // Slaves (including Master's Slave part) write slave:{id}:heartbeat
    // keys via onSlaveHeartbeat(). Count them to know how many responders
    // we can expect on a worker-to-worker broadcast.
    const keys = await this._redis.keys('slave:*:heartbeat');
    return keys.length;
  }

  getManagerStatus():
    | {
        initialized: false;
      }
    | {
        initialized: true;
        isFirstManager: boolean;
      } {
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

  async onManagerHeartbeat(): Promise<void> {
    if (this.isShutdown) return;
    this._managerProcessing = true;
    const redis = this.getRedisInstance();
    if (this._isManagerHeartbeatInited) {
      await redis.set(`master:${this.id}:heartbeat`, Date.now(), 'EX', 20);
    } else {
      const res = (await redis.eval(
        `redis.replicate_commands()local a=redis.call('KEYS','master:*:heartbeat')local b=redis.call('SET','master:'..KEYS[1]..':heartbeat',redis.call('TIME')[1],'EX',20)if not b=='OK'then return{err='FAILED_ADD_MANAGER_HEARTBEAT'}end;return{#a==0 and'true'or'false'}`,
        1,
        this.id
      )) as [string];
      this._isManagerHeartbeatInited = true;
      this._isFirstManager = res[0] === 'true';
    }
    this._managerProcessing = false;
  }

  async onSlaveHeartbeat(): Promise<void> {
    if (this.isShutdown) return;
    this._slaveProcessing = true;
    const redis = this.getRedisInstance();
    await redis.set(`slave:${this.id}:heartbeat`, Date.now(), 'EX', 20);
    this._slaveProcessing = false;
  }

  protected async onShutdown() {
    // Wait finish processing
    await new Promise<void>((rlv, rj) => {
      const id = setInterval(() => {
        if (this._managerProcessing || this._slaveProcessing) return;
        clearInterval(id);
        rlv();
      }, 100);
    });
    await this._redis.quit();
    if (this.instanceType === AppInstanceType.Slave) {
      await this._subOnlyRedis.unsubscribe();
    } else {
      await this._subOnlyRedis.punsubscribe();
    }
    await this._subOnlyRedis.quit();
    logger.info('RedisAdaptor shut down successfully');
  }
}
