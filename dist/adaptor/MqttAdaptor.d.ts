import { Adaptor, MessageBetweenInstance } from './Adaptor';
export interface MqttAdaptorOptions {
    seed: string;
}
export declare class MqttAdaptor extends Adaptor {
    private _broker?;
    private _client?;
    constructor(id: string, isMaster: boolean, mqttOption: MqttAdaptorOptions);
    _send(json: MessageBetweenInstance): Promise<void>;
}
