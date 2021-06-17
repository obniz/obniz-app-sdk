import { Adaptor, MessageBetweenInstance } from './Adaptor';

export interface MemoryAdaptorOptions {
  limit: number;
}

const memoryAdaptorList: MemoryAdaptor[] = [];

export class MemoryAdaptor extends Adaptor {
  constructor(
    id: string,
    isMaster: boolean,
    memoryOption: MemoryAdaptorOptions
  ) {
    super(id, isMaster);
    console.log(memoryOption);
    memoryAdaptorList.push(this);
    this._onReady();
  }

  private _onRedisReady() {
    this._onReady();
  }

  private _onRedisMessage(channel: string, message: string) {
    const parsed = JSON.parse(message) as MessageBetweenInstance;
    // slave functions
    this.onMessage(parsed);
  }

  async _send(json: MessageBetweenInstance): Promise<void> {
    for (const one of memoryAdaptorList) {
      one.onMessage(json);
    }
  }
}
