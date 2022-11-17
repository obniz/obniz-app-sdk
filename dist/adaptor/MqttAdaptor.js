"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MqttAdaptor = void 0;
const Adaptor_1 = require("./Adaptor");
const logger_1 = require("../logger");
const aedes_1 = require("aedes");
const net_1 = require("net");
const mqtt = __importStar(require("mqtt"));
const App_1 = require("../App");
class MqttAdaptor extends Adaptor_1.Adaptor {
    constructor(id, instanceType, mqttOption) {
        super(id, instanceType);
        if (this.instanceType === App_1.AppInstanceType.Master ||
            this.instanceType === App_1.AppInstanceType.Manager) {
            const broker = (0, aedes_1.Server)({
                concurrency: 100,
                heartbeatInterval: 60 * 1000,
                connectTimeout: 30 * 1000,
            });
            const server = (0, net_1.createServer)(broker.handle);
            server.listen(1883, () => {
                logger_1.logger.debug(`mqtt listening on 1883`);
            });
            broker.on('closed', () => {
                logger_1.logger.debug(`mqtt closed`);
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
            broker.subscribe('general', (packet, cb) => {
                // logger.debug(packet.payload.toString());
                const parsed = JSON.parse(packet.payload.toString());
                this.onMessage(parsed);
                cb();
            }, () => {
                logger_1.logger.info('mqtt done subscribing');
                // Wait seconds for children subscription finished.
                setTimeout(() => {
                    this._onReady();
                }, 3 * 1000);
            });
            this._broker = broker;
        }
        else {
            const host = mqttOption;
            logger_1.logger.debug(`mqtt connecting to ${host}`);
            const client = mqtt.connect(host);
            client.on('connect', () => {
                client.subscribe('general', { qos: 0 }, (err, granted) => {
                    if (err) {
                        logger_1.logger.error(err);
                        return;
                    }
                    logger_1.logger.info('mqtt done subscribing');
                    this._onReady();
                });
            });
            client.on('reconnect', () => {
                logger_1.logger.info(`mqtt reconnecting`);
            });
            client.on('close', () => {
                logger_1.logger.info(`mqtt closed`);
            });
            client.on('error', (e) => {
                logger_1.logger.warn(`mqtt Error`, e);
            });
            client.on('message', (topic, message) => {
                // message is Buffer
                // logger.debug(message.toString());
                const parsed = JSON.parse(message.toString());
                this.onMessage(parsed);
            });
            this._client = client;
        }
    }
    async _onSendMessage(data) {
        const message = JSON.stringify(data);
        if (this._broker) {
            this._broker.publish({
                cmd: 'publish',
                qos: 0,
                dup: false,
                topic: 'general',
                payload: Buffer.from(message),
                retain: false,
            }, (err) => { });
        }
        if (this._client) {
            this._client.publish('general', message);
        }
    }
}
exports.MqttAdaptor = MqttAdaptor;
//# sourceMappingURL=MqttAdaptor.js.map