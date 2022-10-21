import { Adaptor } from './Adaptor';
import { MessagesUnion } from '../utils/message';
export declare class MqttAdaptor extends Adaptor {
    private _broker?;
    private _client?;
    constructor(id: string, isMaster: boolean, mqttOption: string);
    _sendMessage(data: MessagesUnion): Promise<void>;
}
