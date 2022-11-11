import { AppInstanceType } from '../App';
import { MessagesUnion } from '../utils/message';
import { Adaptor } from './Adaptor';
export interface MemoryAdaptorOptions {
    limit: number;
}
export declare class MemoryAdaptor extends Adaptor {
    static memoryAdaptorList: MemoryAdaptor[];
    constructor(id: string, instanceType: AppInstanceType, memoryOption: MemoryAdaptorOptions);
    protected _onSendMessage(data: MessagesUnion): Promise<void>;
}
