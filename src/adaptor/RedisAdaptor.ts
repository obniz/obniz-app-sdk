import { Installed_Device } from 'obniz-cloud-sdk/sdk'
import {Adaptor} from './Adaptor'
import  IORedis from 'ioredis'
import { logger } from '../logger';

export class RedisAdaptor extends Adaptor {

  public isMaster = false;

  public id:string;
  private _redis: IORedis.Redis;
  private _pubRedis: IORedis.Redis;

  constructor(id:string, isMaster: boolean) {
    super();

    this.id = id;
    this.isMaster = isMaster

    this._redis = new IORedis(process.env.REDIS_URL);
    this._pubRedis = new IORedis(process.env.REDIS_URL);
    this._redis.subscribe("app", () => {

    });
    this._redis.on("ready", () => {
      logger.debug("ready");
      if (this.isMaster) {
        this.reportRequest().then(()=>{

        }).catch( e => {
          logger.error(e);
        });
      }else{
        this.onReportRequest!().then(()=>{

        }).catch( e => {
          logger.error(e);
        });
      }
    });
    this._redis.on("message", (channel: string, message: string) => {
      const parsed = JSON.parse(message);
      // slave functions
      if ( this.isMaster === parsed.toMaster && this.isMaster === false && (parsed.instanceName === this.id || parsed.instanceName === '*')) {
        if (parsed.action === 'synchronize') {
          this.onSynchronize!(parsed.installs).then(()=>{

          }).catch( e => {
            logger.error(e);
          });
        } else if (parsed.action === 'reportRequest') {
          this.onReportRequest!().then(()=>{

          }).catch( e => {
            logger.error(e);
          });
        }
      // master functions
      } else if ( this.isMaster === parsed.toMaster && this.isMaster === true){
         if (parsed.action === 'report'){
          this.onReported!(parsed.instanceName, parsed.installIds).then(()=>{

          }).catch( e => {
            logger.error(e);
          });
        }
      }
    });
    this._redis.on("+node", () => {
      logger.debug('+node');
    });
    this._redis.on("-node", () => {
      logger.debug('-node');
    });
  }

  async send(json:any) {
    await this._pubRedis.publish("app", JSON.stringify(json));
  }

  async synchronize(instanceName: string, installs: Installed_Device[]) {
    await this.send({
      action: 'synchronize',
      instanceName,
      toMaster: false,
      installs
    })
  }

  async reportRequest() {
    await this.send({
      action: 'reportRequest',
      instanceName: '*',
      toMaster: false
    })
  }

  async report(instanceName: string, installIds: string[]) {
    await this.send({
      action: 'report',
      instanceName,
      toMaster: true,
      installIds
    })
  }
}
