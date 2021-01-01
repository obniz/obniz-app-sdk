import { Installed_Device } from 'obniz-cloud-sdk/sdk'
import Adaptor from './adaptor'
const IORedis = require('ioredis')
import { logger } from '../logger';

export default class RedisAdaptor extends Adaptor {

  public id:string;
  private redis: any
  private pubRedis: any

  public onInstanceInfoUpdated?: (info: any) => Promise<void>

  constructor(id:string) {
    super();

    this.id = id;

    this.redis = new IORedis(process.env.REDIS_URL);
    this.pubRedis = new IORedis(process.env.REDIS_URL);
    this.redis.subscribe("app", () => {

    });
    this.redis.on("ready", async () => {
      if (this.id !== 'master') {
        await this.pubRedis.publish("app", JSON.stringify({
          action: 'info',
          instanceName: 'master',
          from: this.id
        }))
      }
    });
    this.redis.on("message", (channel: string, message: string) => {
      const parsed = JSON.parse(message);
      if (parsed.instanceName === this.id) {
        if (parsed.action === 'start') {
          this.onStart!(parsed.install).then(()=>{

          }).catch( e => {
            logger.error(e);
          });
        } else if (parsed.action === 'update') {
          this.onUpdate!(parsed.install).then(()=>{

          }).catch( e => {
            logger.error(e);
          });
        } else if (parsed.action === 'stop') {
          this.onStop!(parsed.install).then(()=>{

          }).catch( e => {
            logger.error(e);
          });
        } else if (parsed.action === 'info'){
          this.onInstanceInfoUpdated!(parsed);
        } else {
          console.error(`unknown action ${parsed.action}`);
          process.exit(-1);
        }
      }
    });
    this.redis.on("+node", () => {
      logger.debug('+node');
    });
    this.redis.on("-node", () => {
      logger.debug('-node');
    });
  }

  async start(install: Installed_Device, instanceName: string) {
    await this.pubRedis.publish("app", JSON.stringify({
      action: 'start',
      instanceName,
      install
    }));
  }

  async update(install: Installed_Device, instanceName: string) {
    await this.pubRedis.publish("app", JSON.stringify({
      action: 'update',
      instanceName,
      install
    }));
  }

  async stop(install: Installed_Device, instanceName: string) {
    await this.pubRedis.publish("app", JSON.stringify({
      action: 'stop',
      instanceName,
      install
    }));
  }
}