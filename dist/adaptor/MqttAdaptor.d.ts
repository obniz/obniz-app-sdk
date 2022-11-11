import { Adaptor } from './Adaptor';
import { MessagesUnion } from '../utils/message';
import { AppInstanceType } from '../App';
export declare class MqttAdaptor extends Adaptor {
    private _broker?;
    private _client?;
    constructor(id: string, instanceType: AppInstanceType, mqttOption: string);
    _onSendMessage(data: MessagesUnion): Promise<void>;
}
