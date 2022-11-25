import { describe, it, beforeEach } from 'mocha';
import { DummyObniz } from './util/DummyObniz';
import { LogWorker } from './util/LogWorker';
import { App, AppInstanceType } from '../App';
import MockRedis from 'ioredis-mock';
import proxyquire from 'proxyquire';

describe('redis', () => {
  let AppMock: typeof App;
  beforeEach(() => {
    LogWorker.__reset();
    DummyObniz.__reset();
    const stub = {
      ioredis: Object.assign(MockRedis, { '@global': true }),
    } as any;
    AppMock = proxyquire('../App', stub).App;
  });

  it('initialize', async () => {
    const app = new AppMock({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
      database: 'redis',
    });
    await app.startWait({ express: false });
  });
});
