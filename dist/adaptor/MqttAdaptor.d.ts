import { Adaptor, MessageBetweenInstance } from './Adaptor';
export declare class MqttAdaptor extends Adaptor {
    private _broker?;
    private _client?;
    constructor(id: string, isMaster: boolean, mqttOption: string);
    _send(json: MessageBetweenInstance): Promise<void>;
}
