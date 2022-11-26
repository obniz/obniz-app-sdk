import { describe, it, beforeEach } from 'mocha';
import { DummyObniz } from './util/DummyObniz';
import { LogWorker } from './util/LogWorker';
import { App, AppInstanceType } from '../App';
import MockRedis from 'ioredis-mock';
import proxyquire from 'proxyquire';
import { expect } from 'chai';
import { wait } from '../utils/common';
import sinon from 'sinon';
import { deviceA, deviceB } from './util/Device';
import { appEventSamples } from './util/AppEvent';

describe('redis', () => {
  beforeEach(() => {
    LogWorker.__reset();
    DummyObniz.__reset();
  });

  it('not start worker', async () => {
    const TestApp = getProxyedApp({});
    const app1 = new TestApp({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
      database: 'redis',
      instanceName: 'app1',
    });
    expect(LogWorker.workers.length).to.be.equal(0);
  });

  it('one sync request to all slaves via redis', async () => {
    const {
      proxyStub,
      stubs: { getDiffListFromObnizCloudStub, getListFromObnizCloudStub },
    } = createApiStub();
    const TestApp = getProxyedApp(proxyStub);

    const app1 = new TestApp({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
      database: 'redis',
      instanceName: 'app1',
    });
    const app2 = new TestApp({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Slave,
      obnizClass: DummyObniz,
      database: 'redis',
      instanceName: 'app2',
    });
    expect(LogWorker.workers.length).to.be.equal(0);

    let appMessageCount = 0;
    const redisMock = new MockRedis();
    await redisMock.subscribe('app');
    redisMock.on('message', (c, m) => {
      console.log({ c, m });
      appMessageCount++;
    });

    expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);

    await app1.startWait({ express: false });
    await app2.startWait({ express: false });
    await wait(5000);

    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);

    expect(appMessageCount).to.be.equal(2);
  }).timeout(20 * 1000);

  // it('broadcast key request', async () => {
  //   const app1 = new AppMock({
  //     appToken: process.env.AppToken || '',
  //     workerClass: LogWorker,
  //     instanceType: AppInstanceType.Master,
  //     obnizClass: DummyObniz,
  //     database: 'redis',
  //     instanceName: 'app1',
  //   });

  //   const {
  //     getCurrentEventNoStub,
  //     getDiffListFromObnizCloudStub,
  //     getListFromObnizCloudStub,
  //   } = obnizApiStub();

  //   expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
  //   expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
  //   await app1.startWait({ express: false });
  //   await wait(1000);
  //   expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
  //   expect(getListFromObnizCloudStub.callCount).to.be.equal(1);

  //   expect(LogWorker.workers.length).to.be.equal(2);
  //   const response = await app1.request('ping');
  //   expect(response).to.be.deep.equal({
  //     '7877-4454': 'response from 7877-4454',
  //     '0883-8329': 'response from 0883-8329',
  //   });
  // }).timeout(20 * 1000);

  // it('direct key request', async () => {
  //   const app1 = new AppMock({
  //     appToken: process.env.AppToken || '',
  //     workerClass: LogWorker,
  //     instanceType: AppInstanceType.Master,
  //     obnizClass: DummyObniz,
  //     database: 'redis',
  //     instanceName: 'app1',
  //   });

  //   const {
  //     getCurrentEventNoStub,
  //     getDiffListFromObnizCloudStub,
  //     getListFromObnizCloudStub,
  //   } = obnizApiStub();

  //   expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
  //   expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
  //   await app1.startWait({ express: false });
  //   await wait(1000);
  //   expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
  //   expect(getListFromObnizCloudStub.callCount).to.be.equal(1);

  //   expect(LogWorker.workers.length).to.be.equal(2);
  //   const response = await app1.directRequest('7877-4454', 'ping');
  //   expect(response).to.be.deep.equal({
  //     '7877-4454': 'response from 7877-4454',
  //   });
  // }).timeout(20 * 1000);
});

function createApiStub() {
  const getListFromObnizCloudStub = sinon.stub();
  getListFromObnizCloudStub.returns([deviceA, deviceB]);

  const getDiffListFromObnizCloudStub = sinon.stub();
  getDiffListFromObnizCloudStub.returns({
    appEvents: appEventSamples,
    maxId: 4,
  });

  const getCurrentEventNoStub = sinon.stub();
  getCurrentEventNoStub.returns(0);

  return {
    proxyStub: {
      './ObnizCloudClient': Object.assign(
        {
          obnizCloudClientInstance: {
            getListFromObnizCloud: getListFromObnizCloudStub,
            getDiffListFromObnizCloud: getDiffListFromObnizCloudStub,
            getCurrentEventNo: getCurrentEventNoStub,
          },
        },
        { '@global': true }
      ),
    },
    stubs: {
      getListFromObnizCloudStub,
      getDiffListFromObnizCloudStub,
      getCurrentEventNoStub,
    },
  };
}

function getProxyedApp(_anyStub: Record<string, any>) {
  const stub = {
    ioredis: Object.assign(MockRedis, { '@global': true }),
    ..._anyStub,
  } as any;
  return proxyquire('../App', stub).App as typeof App;
}
