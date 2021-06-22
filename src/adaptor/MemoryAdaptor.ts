import { Adaptor, MessageBetweenInstance } from './Adaptor';

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

  async _send(json: MessageBetweenInstance): Promise<void> {
    for (const one of MemoryAdaptor.memoryAdaptorList) {
      one.onMessage(json);
    }
  }
}
