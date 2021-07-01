import { Adaptor, MessageBetweenInstance } from './Adaptor';
export interface MemoryAdaptorOptions {
    limit: number;
}
export declare class MemoryAdaptor extends Adaptor {
    static memoryAdaptorList: MemoryAdaptor[];
    constructor(id: string, isMaster: boolean, memoryOption: MemoryAdaptorOptions);
    _send(json: MessageBetweenInstance): Promise<void>;
}
