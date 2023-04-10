import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { App, AppInstanceType } from '../index';
import { obnizCloudClientInstance } from '../ObnizCloudClient';
import { wait } from '../utils/common';
import { DummyObniz } from './util/DummyObniz';
import { deviceA, deviceB, deviceC } from './util/Device';
import { LogWorker } from './util/LogWorker';
import { MemoryAdaptor } from '../adaptor/MemoryAdaptor';
import {
  appEventAddSamples,
  appEventDeleteAllDeviceSamples,
  appEventDeleteAndUpdateSamples,
  appEventDeleteSamples,
  appEventSamples,
} from './util/AppEvent';
import { DeviceInfo } from '../types/device';

describe('single', () => {
  beforeEach(() => {
    LogWorker.__reset();
    DummyObniz.__reset();
    MemoryAdaptor.memoryAdaptorList = [];
  });

  it('not start worker', async () => {
    new App<DummyObniz>({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
    });

    expect(LogWorker.workers.length).to.be.equal(0);
  });

  it('sync', async () => {
    const app = new App<DummyObniz>({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
    });

    expect(LogWorker.workers.length).to.be.equal(0);

    const {
      getCurrentEventNoStub,
      getDiffListFromObnizCloudStub,
      getListFromObnizCloudStub,
    } = obnizApiStub();

    expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    app.start({ express: false });
    await wait(1000);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);

    expect(LogWorker.workers.length).to.be.equal(2);

    await wait(10 * 1000);
    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    await wait(60 * 1000);
    expect(getListFromObnizCloudStub.callCount).to.be.equal(2);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
  }).timeout(80 * 1000);

  it('webhook', async () => {
    const app = new App<DummyObniz>({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
    });

    expect(LogWorker.workers.length).to.be.equal(0);

    const {
      getCurrentEventNoStub,
      getDiffListFromObnizCloudStub,
      getListFromObnizCloudStub,
    } = obnizApiStub();

    // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
    expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
    app.start({ express: false });
    await wait(100);
    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    expect(LogWorker.workers.length).to.be.equal(2);

    app.expressWebhook({} as any, {} as any);

    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
  });

  it('add', async () => {
    const app = new App<DummyObniz>({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
    });

    expect(LogWorker.workers.length).to.be.equal(0);

    const {
      getCurrentEventNoStub,
      getDiffListFromObnizCloudStub,
      getListFromObnizCloudStub,
    } = obnizApiStub();

    // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
    expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
    app.start({ express: false });
    await wait(10);
    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    expect(LogWorker.workers.length).to.be.equal(2);

    getDiffListFromObnizCloudStub.returns({
      appEvents: appEventAddSamples,
      maxId: 5,
    });
    app.expressWebhook({} as any, {} as any);
    await wait(10);

    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(LogWorker.workers.length).to.be.equal(3);
  });

  it('remove', async () => {
    const app = new App<DummyObniz>({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
    });

    expect(LogWorker.workers.length).to.be.equal(0);

    const {
      getCurrentEventNoStub,
      getDiffListFromObnizCloudStub,
      getListFromObnizCloudStub,
    } = obnizApiStub();

    // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
    expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
    app.start({ express: false });
    await wait(10);
    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    expect(LogWorker.workers.length).to.be.equal(2);

    getDiffListFromObnizCloudStub.returns({
      appEvents: appEventDeleteSamples,
      maxId: 5,
    });

    app.expressWebhook({} as any, {} as any);
    await wait(10);

    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(LogWorker.workers.length).to.be.equal(1);
  });

  it('remove all devices', async () => {
    const app = new App<DummyObniz>({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
    });

    expect(LogWorker.workers.length).to.be.equal(0);

    const {
      getCurrentEventNoStub,
      getDiffListFromObnizCloudStub,
      getListFromObnizCloudStub,
    } = obnizApiStub();

    // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
    expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
    app.start({ express: false });
    await wait(10);
    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    expect(LogWorker.workers.length).to.be.equal(2);

    getDiffListFromObnizCloudStub.returns({
      appEvents: appEventDeleteAllDeviceSamples,
      maxId: 6,
    });

    app.expressWebhook({} as any, {} as any);
    await wait(10);

    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(LogWorker.workers.length).to.be.equal(0);
  });

  it('remove and add', async () => {
    const app = new App<DummyObniz>({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
    });

    expect(LogWorker.workers.length).to.be.equal(0);

    const {
      getCurrentEventNoStub,
      getDiffListFromObnizCloudStub,
      getListFromObnizCloudStub,
    } = obnizApiStub();

    // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
    expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
    app.start({ express: false });
    await wait(10);
    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    expect(LogWorker.workers.length).to.be.equal(2);
    expect((LogWorker.workers[0] as any).obniz.id).to.be.equal(deviceA.id);

    getDiffListFromObnizCloudStub.returns({
      appEvents: appEventDeleteAndUpdateSamples,
      maxId: 6,
    });
    app.expressWebhook({} as any, {} as any);
    await wait(10);

    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(LogWorker.workers.length).to.be.equal(2);
    expect((LogWorker.workers[0] as any).obniz.id).to.be.equal(deviceB.id);
  });

  it('access token', async () => {
    const cloudSdkToken = '989786r7tyghjnkooyfvasdfa';
    const app = new App<DummyObniz>({
      appToken: cloudSdkToken,
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
    });

    expect(LogWorker.workers.length).to.be.equal(0);

    const {
      getCurrentEventNoStub,
      getDiffListFromObnizCloudStub,
      getListFromObnizCloudStub,
    } = obnizApiStub();
    // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
    expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
    app.start({ express: false });
    await wait(10);

    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(LogWorker.workers.length).to.be.equal(2);
    expect(DummyObniz.obnizes.length).to.be.equal(2);

    const obnizC = DummyObniz.obnizes[0];
    expect(obnizC.options.access_token).to.be.equal(cloudSdkToken);
    expect(obnizC.options.auto_connect).to.be.equal(false);
  });

  it('different env', async () => {
    const cloudSdkToken = '989786r7tyghjnkooyfvasdfa';
    const app = new App<DummyObniz>({
      appToken: cloudSdkToken,
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
      obnizOption: { obniz_server: 'ws://localhost:9999' },
      obnizCloudSdkOption: { baseUrl: 'http://localhost:8888' },
    });

    expect(LogWorker.workers.length).to.be.equal(0);

    const { getListFromObnizCloudStub } = obnizApiStub();
    // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
    expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
    app.start({ express: false });

    await wait(10);
    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);

    expect(getListFromObnizCloudStub.args[0][0]).to.be.equal(cloudSdkToken);

    expect(getListFromObnizCloudStub.args[0][1]).to.be.deep.equal({
      baseUrl: 'http://localhost:8888',
    });
    await wait(10);
    expect(LogWorker.workers.length).to.be.equal(2);
    expect(DummyObniz.obnizes.length).to.be.equal(2);

    const obnizA = DummyObniz.obnizes[0];
    expect(obnizA.options.access_token).to.be.equal(cloudSdkToken);
    expect(obnizA.options.auto_connect).to.be.equal(false);
    expect(obnizA.options.obniz_server).to.be.equal('ws://localhost:9999');
  });

  it('request', async () => {
    const app = new App<DummyObniz>({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
    });

    expect(LogWorker.workers.length).to.be.equal(0);

    const {
      getCurrentEventNoStub,
      getDiffListFromObnizCloudStub,
      getListFromObnizCloudStub,
    } = obnizApiStub();

    expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    app.start({ express: false });
    await wait(1000);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);

    expect(LogWorker.workers.length).to.be.equal(2);

    const response = await app.request('KEY');

    expect(response).to.be.deep.equal({
      '7877-4454': 'response from 7877-4454',
      '0883-8329': 'response from 0883-8329',
    });
  }).timeout(80 * 1000);

  it('use custom fetcher', async () => {
    const fetcherStub = sinon.stub();
    fetcherStub.onCall(0).returns([
      {
        id: '0000-0001',
        hardware: 'obnizb1',
        configs: '{}',
      },
      {
        id: '0000-0002',
        hardware: 'obnizb1',
        configs: '{}',
      },
      {
        id: '0000-0003',
        hardware: 'obnizb1',
        configs: '{}',
      },
    ] as DeviceInfo[]);
    fetcherStub.returns([
      {
        id: '0000-0001',
        hardware: 'obnizb1',
        configs: '{}',
      },
      {
        id: '0000-0002',
        hardware: 'obnizb1',
        configs: '{}',
      },
    ] as DeviceInfo[]);

    const app = new App<DummyObniz>({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
      fetcher: fetcherStub,
    });
    expect(LogWorker.workers.length).to.be.equal(0);
    expect(fetcherStub.callCount).to.be.equal(0);

    await app.startWait({
      express: false,
    });

    await wait(1000);

    expect(fetcherStub.callCount).to.be.equal(1);
    expect(LogWorker.workers.length).to.be.equal(3);

    app.expressWebhook({} as any, {} as any);
    await wait(1000);

    expect(fetcherStub.callCount).to.be.equal(2);
    expect(LogWorker.workers.length).to.be.equal(2);
  }).timeout(30 * 1000);
});

function obnizApiStub() {
  const getListFromObnizCloudStub = sinon.stub();
  getListFromObnizCloudStub.returns([deviceA, deviceB]);
  obnizCloudClientInstance.getListFromObnizCloud = getListFromObnizCloudStub;

  const getDiffListFromObnizCloudStub = sinon.stub();
  getDiffListFromObnizCloudStub.returns({
    appEvents: appEventSamples,
    maxId: 4,
  });
  obnizCloudClientInstance.getDiffListFromObnizCloud =
    getDiffListFromObnizCloudStub;

  const getCurrentEventNoStub = sinon.stub();
  getCurrentEventNoStub.returns(0);
  obnizCloudClientInstance.getCurrentEventNo = getCurrentEventNoStub;

  return {
    getListFromObnizCloudStub,
    getDiffListFromObnizCloudStub,
    getCurrentEventNoStub,
  };
}
