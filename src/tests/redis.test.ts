import { describe, it, beforeEach, afterEach } from 'mocha';
import { DummyObniz } from './util/DummyObniz';
import { LogWorker } from './util/LogWorker';
import { App, AppInstanceType } from '../App';
import IORedis from 'ioredis';
import { expect } from 'chai';
import { wait } from '../utils/common';
import sinon from 'sinon';
import { deviceA, deviceB } from './util/Device';
import { appEventSamples } from './util/AppEvent';
import { RedisMemoryServer } from 'redis-memory-server';
import { obnizCloudClientInstance } from '../ObnizCloudClient';

let redisServer: RedisMemoryServer;
let redisAddress: string;

describe('redis', () => {
  beforeEach(async () => {
    redisServer = new RedisMemoryServer();
    redisAddress = `redis://${await redisServer.getHost()}:${await redisServer.getPort()}`;
    console.log(`redis-memory-server started on ${redisAddress}`);
    LogWorker.__reset();
    DummyObniz.__reset();
  });

  afterEach(async () => {
    if (redisServer) {
      await redisServer.stop();
      console.log('redis-memory-server stopped');
    }
  });

  it('not start worker', async () => {
    const app1 = new App({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
      database: 'redis',
      instanceName: 'app1',
      databaseConfig: redisAddress,
    });
    expect(LogWorker.workers.length).to.be.equal(0);
    await app1.shutdown();
  });

  it('one sync request to all slaves via redis', async () => {
    const app1 = new App({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
      database: 'redis',
      instanceName: 'app1',
      databaseConfig: redisAddress,
    });
    const app2 = new App({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Slave,
      obnizClass: DummyObniz,
      database: 'redis',
      instanceName: 'app2',
      databaseConfig: redisAddress,
    });
    expect(LogWorker.workers.length).to.be.equal(0);

    const {
      getCurrentEventNoStub,
      getDiffListFromObnizCloudStub,
      getListFromObnizCloudStub,
    } = obnizApiStub();

    let appMessageCount = 0;
    const redisClient = new IORedis(redisAddress);
    await redisClient.subscribe('app');
    redisClient.on('message', (c, m) => {
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

    redisClient.disconnect();
    await app1.shutdown();
    await app2.shutdown();
  }).timeout(20 * 1000);

  it('broadcast key request', async () => {
    const app1 = new App({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
      database: 'redis',
      instanceName: 'app1',
      databaseConfig: redisAddress,
    });

    const {
      getCurrentEventNoStub,
      getDiffListFromObnizCloudStub,
      getListFromObnizCloudStub,
    } = obnizApiStub();

    expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    await app1.startWait({ express: false });
    await wait(10000);
    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);

    expect(LogWorker.workers.length).to.be.equal(2);
    const response = await app1.request('ping');
    expect(response).to.be.deep.equal({
      '7877-4454': 'response from 7877-4454',
      '0883-8329': 'response from 0883-8329',
    });
    await app1.shutdown();
  }).timeout(30 * 1000);

  it('direct key request', async () => {
    const app1 = new App({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
      database: 'redis',
      instanceName: 'app1',
      databaseConfig: redisAddress,
    });

    const {
      getCurrentEventNoStub,
      getDiffListFromObnizCloudStub,
      getListFromObnizCloudStub,
    } = obnizApiStub();

    expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
    expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    await app1.startWait({ express: false });
    await wait(10000);
    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    expect(getListFromObnizCloudStub.callCount).to.be.equal(1);

    expect(LogWorker.workers.length).to.be.equal(2);
    const response = await app1.directRequest('7877-4454', 'ping');
    expect(response).to.be.deep.equal({
      '7877-4454': 'response from 7877-4454',
    });
    await app1.shutdown();
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
