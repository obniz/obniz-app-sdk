import { Installed_Device } from 'obniz-cloud-sdk/sdk'
import Adaptor from './adaptor'
const IORedis = require('ioredis')
import { logger } from '../logger';

export default class RedisAdaptor extends Adaptor {

  public isMaster = false;

  public id:string;
  private redis: any
  private pubRedis: any

  constructor(id:string, isMaster: boolean) {
    super();

    this.id = id;
    this.isMaster = isMaster

    this.redis = new IORedis(process.env.REDIS_URL);
    this.pubRedis = new IORedis(process.env.REDIS_URL);
    this.redis.subscribe("app", () => {

    });
    this.redis.on("ready", () => {
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
    this.redis.on("message", (channel: string, message: string) => {
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
    this.redis.on("+node", () => {
      logger.debug('+node');
    });
    this.redis.on("-node", () => {
      logger.debug('-node');
    });
  }

  async send(json:any) {
    await this.pubRedis.publish("app", JSON.stringify(json));
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