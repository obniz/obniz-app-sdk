import { MessagesUnion } from '../utils/message';
import { Adaptor } from './Adaptor';
export interface MemoryAdaptorOptions {
    limit: number;
}
export declare class MemoryAdaptor extends Adaptor {
    static memoryAdaptorList: MemoryAdaptor[];
    constructor(id: string, isMaster: boolean, memoryOption: MemoryAdaptorOptions);
    protected _sendMessage(data: MessagesUnion): Promise<void>;
}
