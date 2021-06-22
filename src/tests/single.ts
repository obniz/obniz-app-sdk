import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { App, AppInstanceType } from '../index';
import { sharedInstalledDeviceManager } from '../install';
import { wait } from './util/tools';
import { DummyObniz } from './util/DummyObniz';
import { deviceA, deviceB } from './util/Device';
import { LogWorker } from './util/LogWorker';
import { MemoryAdaptor } from '../adaptor/MemoryAdaptor';

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

    const getListFromObnizCloudStub = sinon.stub();
    getListFromObnizCloudStub.returns([deviceA, deviceB]);
    sharedInstalledDeviceManager.getListFromObnizCloud = getListFromObnizCloudStub;
    // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
    expect(
      (sharedInstalledDeviceManager.getListFromObnizCloud as sinon.SinonStub)
        .callCount
    ).to.be.equal(0);
    app.start({ express: false });
    expect(
      (sharedInstalledDeviceManager.getListFromObnizCloud as sinon.SinonStub)
        .callCount
    ).to.be.equal(1);
    await wait(100);
    expect(LogWorker.workers.length).to.be.equal(2);

    await wait(10 * 1000);
    expect(
      (sharedInstalledDeviceManager.getListFromObnizCloud as sinon.SinonStub)
        .callCount
    ).to.be.equal(1);
    await wait(60 * 1000);
    expect(
      (sharedInstalledDeviceManager.getListFromObnizCloud as sinon.SinonStub)
        .callCount
    ).to.be.equal(2);
  }).timeout(80 * 1000);

  it('webhook', async () => {
    const app = new App<DummyObniz>({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
    });

    expect(LogWorker.workers.length).to.be.equal(0);

    const getListFromObnizCloudStub = sinon.stub();
    getListFromObnizCloudStub.returns([deviceA, deviceB]);
    sharedInstalledDeviceManager.getListFromObnizCloud = getListFromObnizCloudStub;
    // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
    expect(
      (sharedInstalledDeviceManager.getListFromObnizCloud as sinon.SinonStub)
        .callCount
    ).to.be.equal(0);
    app.start({ express: false });
    expect(
      (sharedInstalledDeviceManager.getListFromObnizCloud as sinon.SinonStub)
        .callCount
    ).to.be.equal(1);
    await wait(100);
    expect(LogWorker.workers.length).to.be.equal(2);

    app.expressWebhook({} as any, {} as any);

    expect(
      (sharedInstalledDeviceManager.getListFromObnizCloud as sinon.SinonStub)
        .callCount
    ).to.be.equal(2);
  });

  it('add', async () => {
    const app = new App<DummyObniz>({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
    });

    expect(LogWorker.workers.length).to.be.equal(0);

    const getListFromObnizCloudStub = sinon.stub();
    getListFromObnizCloudStub.returns([deviceA]);
    sharedInstalledDeviceManager.getListFromObnizCloud = getListFromObnizCloudStub;
    // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
    expect(
      (sharedInstalledDeviceManager.getListFromObnizCloud as sinon.SinonStub)
        .callCount
    ).to.be.equal(0);
    app.start({ express: false });
    expect(
      (sharedInstalledDeviceManager.getListFromObnizCloud as sinon.SinonStub)
        .callCount
    ).to.be.equal(1);
    await wait(10);
    expect(LogWorker.workers.length).to.be.equal(1);

    getListFromObnizCloudStub.returns([deviceA, deviceB]);
    app.expressWebhook({} as any, {} as any);
    await wait(10);

    expect(
      (sharedInstalledDeviceManager.getListFromObnizCloud as sinon.SinonStub)
        .callCount
    ).to.be.equal(2);
    expect(LogWorker.workers.length).to.be.equal(2);
  });

  it('remove', async () => {
    const app = new App<DummyObniz>({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
    });

    expect(LogWorker.workers.length).to.be.equal(0);

    const getListFromObnizCloudStub = sinon.stub();
    getListFromObnizCloudStub.returns([deviceA, deviceB]);
    sharedInstalledDeviceManager.getListFromObnizCloud = getListFromObnizCloudStub;
    // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
    expect(
      (sharedInstalledDeviceManager.getListFromObnizCloud as sinon.SinonStub)
        .callCount
    ).to.be.equal(0);
    app.start({ express: false });
    await wait(10);
    expect(
      (sharedInstalledDeviceManager.getListFromObnizCloud as sinon.SinonStub)
        .callCount
    ).to.be.equal(1);
    expect(LogWorker.workers.length).to.be.equal(2);

    getListFromObnizCloudStub.returns([deviceA]);
    app.expressWebhook({} as any, {} as any);
    await wait(10);

    expect(
      (sharedInstalledDeviceManager.getListFromObnizCloud as sinon.SinonStub)
        .callCount
    ).to.be.equal(2);
    expect(LogWorker.workers.length).to.be.equal(1);
  });

  it('remove and add', async () => {
    const app = new App<DummyObniz>({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
    });

    expect(LogWorker.workers.length).to.be.equal(0);

    const getListFromObnizCloudStub = sinon.stub();
    getListFromObnizCloudStub.returns([deviceA]);
    sharedInstalledDeviceManager.getListFromObnizCloud = getListFromObnizCloudStub;
    // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
    expect(
      (sharedInstalledDeviceManager.getListFromObnizCloud as sinon.SinonStub)
        .callCount
    ).to.be.equal(0);
    app.start({ express: false });
    await wait(10);
    expect(
      (sharedInstalledDeviceManager.getListFromObnizCloud as sinon.SinonStub)
        .callCount
    ).to.be.equal(1);
    expect(LogWorker.workers.length).to.be.equal(1);
    expect((LogWorker.workers[0] as any).obniz.id).to.be.equal(deviceA.id);

    getListFromObnizCloudStub.returns([deviceB]);
    app.expressWebhook({} as any, {} as any);
    await wait(10);

    expect(
      (sharedInstalledDeviceManager.getListFromObnizCloud as sinon.SinonStub)
        .callCount
    ).to.be.equal(2);
    expect(LogWorker.workers.length).to.be.equal(1);
    expect((LogWorker.workers[0] as any).obniz.id).to.be.equal(deviceB.id);
  });
});
