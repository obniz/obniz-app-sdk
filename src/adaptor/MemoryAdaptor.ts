import { AppInstanceType } from '../App';
import { MessagesUnion } from '../utils/message';
import { Adaptor } from './Adaptor';

export interface MemoryAdaptorOptions {
  limit: number;
}

export class MemoryAdaptor extends Adaptor {
  static memoryAdaptorList: MemoryAdaptor[] = [];

  constructor(
    id: string,
    instanceType: AppInstanceType,
    memoryOption: MemoryAdaptorOptions
  ) {
    super(id, instanceType);
    MemoryAdaptor.memoryAdaptorList.push(this);
    this._onReady();
  }

  protected async _onSendMessage(data: MessagesUnion): Promise<void> {
    for (const one of MemoryAdaptor.memoryAdaptorList) {
      one.onMessage(data);
    }
  }

  public async getSlaveInstanceCount(): Promise<number> {
    // Master includes a Slave part and is counted here as well.
    return MemoryAdaptor.memoryAdaptorList.filter(
      (a) =>
        a.instanceType === AppInstanceType.Slave ||
        a.instanceType === AppInstanceType.Master
    ).length;
  }

  protected async onShutdown() {
    // Nothing to do
  }
}
