import { Installed_Device } from 'obniz-cloud-sdk/sdk';
import { Adaptor } from './Adaptor';
import IORedis from 'ioredis';
import { logger } from '../logger';

export class RedisAdaptor extends Adaptor {
  public isMaster = false;

  public id: string;
  private _redis: IORedis.Redis;
  private _pubRedis: IORedis.Redis;

  constructor(
    id: string,
    isMaster: boolean,
    redisOption: IORedis.RedisOptions
  ) {
    super();

    this.id = id;
    this.isMaster = isMaster;

    this._redis = new IORedis(redisOption);
    this._pubRedis = new IORedis(redisOption);
    console.log(redisOption);
    this._redis.subscribe('app', () => {});
    this._redis.on('ready', () => {
      logger.debug('ready');
      if (this.isMaster) {
        this.reportRequest()
          .then(() => {})
          .catch((e) => {
            logger.error(e);
          });
      } else {
        if (this.onReportRequest) {
          this.onReportRequest()
            .then(() => {})
            .catch((e) => {
              logger.error(e);
            });
        }
      }
    });
    this._redis.on('message', (channel: string, message: string) => {
      const parsed = JSON.parse(message);
      // slave functions
      if (
        this.isMaster === parsed.toMaster &&
        this.isMaster === false &&
        (parsed.instanceName === this.id || parsed.instanceName === '*')
      ) {
        if (parsed.action === 'synchronize') {
          if (this.onSynchronize) {
            this.onSynchronize(parsed.installs)
              .then(() => {})
              .catch((e) => {
                logger.error(e);
              });
          }
        } else if (parsed.action === 'reportRequest') {
          if (this.onReportRequest) {
            this.onReportRequest()
              .then(() => {})
              .catch((e) => {
                logger.error(e);
              });
          }
        }
        // master functions
      } else if (this.isMaster === parsed.toMaster && this.isMaster === true) {
        if (parsed.action === 'report') {
          if (this.onReported) {
            this.onReported(parsed.instanceName, parsed.installIds)
              .then(() => {})
              .catch((e) => {
                logger.error(e);
              });
          }
        }
      }
    });
    this._redis.on('+node', () => {
      logger.debug('+node');
    });
    this._redis.on('-node', () => {
      logger.debug('-node');
    });
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async send(json: any): Promise<void> {
    await this._pubRedis.publish('app', JSON.stringify(json));
  }

  async synchronize(
    instanceName: string,
    installs: Installed_Device[]
  ): Promise<void> {
    await this.send({
      action: 'synchronize',
      instanceName,
      toMaster: false,
      installs,
    });
  }

  async reportRequest(): Promise<void> {
    await this.send({
      action: 'reportRequest',
      instanceName: '*',
      toMaster: false,
    });
  }

  async report(instanceName: string, installIds: string[]): Promise<void> {
    await this.send({
      action: 'report',
      instanceName,
      toMaster: true,
      installIds,
    });
  }
}
