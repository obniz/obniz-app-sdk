import { MessagesUnion } from '../utils/message';
import { Adaptor } from './Adaptor';

export interface MemoryAdaptorOptions {
  limit: number;
}

export class MemoryAdaptor extends Adaptor {
  static memoryAdaptorList: MemoryAdaptor[] = [];

  constructor(
    id: string,
    isMaster: boolean,
    memoryOption: MemoryAdaptorOptions
  ) {
    super(id, isMaster);
    MemoryAdaptor.memoryAdaptorList.push(this);
    this._onReady();
  }

  protected async _sendMessage(data: MessagesUnion): Promise<void> {
    for (const one of MemoryAdaptor.memoryAdaptorList) {
      one.onMessage(data);
    }
  }
}
