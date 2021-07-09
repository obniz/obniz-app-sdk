import { IObniz, IObnizOptions } from '../../Obniz.interface';

export interface DummyObnizLog {
  date: Date;
  eventType: 'close' | 'connect' | 'autoConnectOn' | 'autoConnectOff';
}

export class DummyObniz implements IObniz {
  static version = '3.16.0';
  static obnizes: DummyObniz[] = [];
  __logs: DummyObnizLog[] = [];
  __autoConnect = false;
  id: string;
  options: IObnizOptions;

  static __reset(): void {
    DummyObniz.obnizes = [];
  }

  constructor(id: string, options: IObnizOptions) {
    this.id = id;
    this.options = options;
    DummyObniz.obnizes.push(this);
  }

  get autoConnect(): boolean {
    return this.__autoConnect;
  }

  set autoConnect(val: boolean) {
    this.__logs.push({
      date: new Date(),
      eventType: val ? 'autoConnectOn' : 'autoConnectOff',
    });
    this.__autoConnect = val;
  }

  async closeWait(): Promise<void> {
    this.__logs.push({ date: new Date(), eventType: 'close' });
  }

  connect(): void {
    this.__logs.push({ date: new Date(), eventType: 'connect' });
  }
}
