import { Worker } from '../../Worker';
import { DummyObniz } from './DummyObniz';
import { App } from '../../App';
import { IObnizOptions } from '../../Obniz.interface';
import { DeviceInfo } from '../../types/device';

export type WorkerLogEventType =
  | 'onStart'
  | 'onLoop'
  | 'onEnd'
  | 'onRequest'
  | 'onObnizConnect'
  | 'onObnizLoop'
  | 'onObnizClose';

export interface WorkerLog {
  obnizId: string;
  date: Date;
  eventType: WorkerLogEventType;
  requestVal?: string;
}

export class LogWorker extends Worker<DummyObniz> {
  static workers: LogWorker[] = [];
  __logs: WorkerLog[] = [];
  __addedObnizLoopEvent = false;
  __addedLoopEvent = false;

  static __reset(): void {
    LogWorker.workers = [];
  }

  constructor(
    deviceInfo: DeviceInfo,
    app: App<DummyObniz>,
    option: IObnizOptions = {}
  ) {
    super(deviceInfo, app, option);
    LogWorker.workers.push(this);
  }

  __getOption() {
    return this._obnizOption;
  }

  async onStart(): Promise<void> {
    this.__addedLoopEvent = false;
    this.__addLog('onStart');
  }

  async onLoop(): Promise<void> {
    if (!this.__addedLoopEvent) {
      this.__addedLoopEvent = true;
      this.__addLog('onLoop');
    }
  }

  async onEnd(): Promise<void> {
    this.__addLog('onEnd');
    LogWorker.workers = LogWorker.workers.filter((e) => e !== this);
  }

  async onRequest(key: string): Promise<string> {
    this.__addLog('onRequest');
    return `response from ${this.obniz.id}`;
  }

  async onObnizConnect(obniz: DummyObniz): Promise<void> {
    this.__addedObnizLoopEvent = false;
    this.__addLog('onObnizConnect');
  }

  async onObnizLoop(obniz: DummyObniz): Promise<void> {
    if (!this.__addedObnizLoopEvent) {
      this.__addedObnizLoopEvent = true;
      this.__addLog('onObnizLoop');
    }
  }

  async onObnizClose(obniz: DummyObniz): Promise<void> {
    this.__addLog('onObnizClose');
  }

  protected __addLog(eventType: WorkerLogEventType, requestVal?: string): void {
    this.__logs.push({
      date: new Date(),
      eventType,
      obnizId: this.obniz.id,
      requestVal,
    });
  }
}
