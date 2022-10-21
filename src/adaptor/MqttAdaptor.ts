import { Adaptor } from './Adaptor';
import { logger } from '../logger';

import { Server, Aedes, AedesPublishPacket } from 'aedes';
import { createServer } from 'net';

import * as mqtt from 'mqtt';
import { MessagesUnion } from '../utils/message';

export class MqttAdaptor extends Adaptor {
  private _broker?: Aedes;
  private _client?: mqtt.Client;

  constructor(id: string, isMaster: boolean, mqttOption: string) {
    super(id, isMaster);
    if (isMaster) {
      const broker = Server({
        concurrency: 100,
        heartbeatInterval: 60 * 1000,
        connectTimeout: 30 * 1000,
      });

      const server = createServer(broker.handle);
      server.listen(1883, () => {
        logger.debug(`mqtt listening on 1883`);
      });

      broker.on('closed', () => {
        logger.debug(`mqtt closed`);
      });

      // broker.on('client', (client) => {
      //   logger.debug(`mqtt client: ${client.id} connected`);
      // });

      // broker.on('clientDisconnect', (client) => {
      //   logger.debug(`mqtt client: ${client.id} disconnected`);
      // });

      // broker.on('publish', (packet, client) => {
      //   logger.debug(`client: ${client} published`);
      //   logger.debug(packet);
      // });

      // broker.on('subscribe', (subscriptions, client) => {
      //   console.log(`client: ${client.id} subsribe`);
      // });

      // broker.on('unsubscribe', (subscriptions, client) => {
      //   console.log(`client: ${client.id} unsubsribe`);
      // });

      broker.subscribe(
        'general',
        (packet: AedesPublishPacket, cb) => {
          // logger.debug(packet.payload.toString());
          const parsed = JSON.parse(packet.payload.toString()) as MessagesUnion;
          this.onMessage(parsed);
          cb();
        },
        () => {
          logger.info('mqtt done subscribing');
          // Wait seconds for children subscription finished.
          setTimeout(() => {
            this._onReady();
          }, 3 * 1000);
        }
      );
      this._broker = broker;
    } else {
      const host = mqttOption;
      logger.debug(`mqtt connecting to ${host}`);
      const client = mqtt.connect(host);
      client.on('connect', () => {
        client.subscribe('general', { qos: 0 }, (err, granted) => {
          if (err) {
            logger.error(err);
            return;
          }
          logger.info('mqtt done subscribing');
          this._onReady();
        });
      });
      client.on('reconnect', () => {
        logger.info(`mqtt reconnecting`);
      });
      client.on('close', () => {
        logger.info(`mqtt closed`);
      });
      client.on('error', (e) => {
        logger.warn(`mqtt Error`, e);
      });

      client.on('message', (topic: string, message: Buffer) => {
        // message is Buffer
        // logger.debug(message.toString());
        const parsed = JSON.parse(message.toString()) as MessagesUnion;
        this.onMessage(parsed);
      });
      this._client = client;
    }
  }

  async _sendMessage(data: MessagesUnion): Promise<void> {
    const message = JSON.stringify(data);
    if (this._broker) {
      this._broker.publish(
        {
          cmd: 'publish',
          qos: 0,
          dup: false,
          topic: 'general',
          payload: Buffer.from(message),
          retain: false,
        },
        (err) => {}
      );
    }
    if (this._client) {
      this._client.publish('general', message);
    }
  }
}
