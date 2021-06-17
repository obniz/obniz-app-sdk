import { Adaptor, MessageBetweenInstance } from './Adaptor';
export interface MemoryAdaptorOptions {
    limit: number;
}
export declare class MemoryAdaptor extends Adaptor {
    constructor(id: string, isMaster: boolean, memoryOption: MemoryAdaptorOptions);
    private _onRedisReady;
    private _onRedisMessage;
    _send(json: MessageBetweenInstance): Promise<void>;
}
