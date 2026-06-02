import { describe, it, beforeEach, afterEach } from 'mocha';
import { DummyObniz } from './util/DummyObniz';
import { LogWorker } from './util/LogWorker';
import { App, AppInstanceType } from '../App';
import IORedis from 'ioredis';
import { expect } from 'chai';
import { wait } from '../utils/common';
import sinon from 'sinon';
import { deviceA, deviceB, deviceC } from './util/Device';
import { appEventSamples } from './util/AppEvent';
import { RedisMemoryServer } from 'redis-memory-server';
import { obnizCloudClientInstance } from '../ObnizCloudClient';
import { DeviceInfo } from '../types/device';

let redisServer: RedisMemoryServer;
let redisAddress: string;

describe('redis', () => {
  beforeEach(async () => {
    redisServer = new RedisMemoryServer();
    redisAddress = `redis://${await redisServer.getHost()}:${await redisServer.getPort()}`;
    console.log(`redis-memory-server started on ${redisAddress}`);
    // Ensure a clean keyspace per test. redis-memory-server may hand back a
    // shared/persisted dataset in some environments; without this, a freshly
    // started Slave can pick up another test's leftover worker assignments
    // (Slaves now bootstrap their workers directly from Redis on startup).
    const flushClient = new IORedis(redisAddress);
    await flushClient.flushall();
    flushClient.disconnect();
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

  it('worker-to-worker broadcast request across slaves', async () => {
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

    obnizApiStub();

    await app1.startWait({ express: false });
    await app2.startWait({ express: false });
    await wait(10000);

    expect(LogWorker.workers.length).to.be.equal(2);

    const senderWorker = LogWorker.workers[0];
    const response = await senderWorker.request('ping', 3000);
    expect(response).to.be.deep.equal({
      '7877-4454': 'response from 7877-4454',
      '0883-8329': 'response from 0883-8329',
    });

    await app1.shutdown();
    await app2.shutdown();
  }).timeout(30 * 1000);

  it('worker-to-worker direct request across slaves', async () => {
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

    obnizApiStub();

    await app1.startWait({ express: false });
    await app2.startWait({ express: false });
    await wait(10000);

    expect(LogWorker.workers.length).to.be.equal(2);

    const senderWorker = LogWorker.workers[0];
    const otherWorker = LogWorker.workers.find(
      (w) => w.deviceInfo.id !== senderWorker.deviceInfo.id
    );
    if (!otherWorker) throw new Error('no other worker');

    const response = await senderWorker.directRequest(
      otherWorker.deviceInfo.id,
      'ping',
      3000
    );
    expect(response).to.be.deep.equal({
      [otherWorker.deviceInfo.id]: `response from ${otherWorker.deviceInfo.id}`,
    });

    await app1.shutdown();
    await app2.shutdown();
  }).timeout(30 * 1000);

  it('worker-to-worker broadcast times out when one slave is unresponsive', async () => {
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
    const app3 = new App({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Slave,
      obnizClass: DummyObniz,
      database: 'redis',
      instanceName: 'app3',
      databaseConfig: redisAddress,
    });

    const { getListFromObnizCloudStub } = obnizApiStub();
    // 3 devices so each of the 3 slaves ends up hosting exactly one worker.
    getListFromObnizCloudStub.returns([deviceA, deviceB, deviceC]);

    await app1.startWait({ express: false });
    await app2.startWait({ express: false });
    await app3.startWait({ express: false });
    await wait(10000);

    expect(LogWorker.workers.length).to.be.equal(3);

    // Silence app3's slave: it will receive workerKeyRequest messages but
    // never respond, simulating a dropped or hung peer.
    const app3Slave = (app3 as any)._slave;
    app3Slave._adaptor.onWorkerKeyRequest = async () => {
      /* intentionally swallow — do not respond */
    };

    const senderWorker = LogWorker.workers.find(
      (w) => (w as any).slave._instanceName === 'app1'
    );
    const app3Worker = LogWorker.workers.find(
      (w) => (w as any).slave._instanceName === 'app3'
    );
    if (!senderWorker || !app3Worker) {
      throw new Error('expected one worker per slave');
    }

    const timeoutMs = 2000;
    const started = Date.now();
    const response = await senderWorker.request('ping', timeoutMs);
    const elapsed = Date.now() - started;

    // Because app3 never replies, the broadcast must wait until timeout
    // instead of early-resolving.
    expect(elapsed).to.be.greaterThanOrEqual(timeoutMs - 100);
    // Only 2 of the 3 workers should have responded — the one on the
    // unresponsive slave is missing from the partial result set.
    expect(Object.keys(response).length).to.be.equal(2);
    expect(response[app3Worker.deviceInfo.id]).to.be.equal(undefined);

    await app1.shutdown();
    await app2.shutdown();
    await app3.shutdown();
  }).timeout(60 * 1000);

  it('master->worker and worker->worker broadcasts do not interfere', async () => {
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

    obnizApiStub();

    await app1.startWait({ express: false });
    await app2.startWait({ express: false });
    await wait(10000);

    expect(LogWorker.workers.length).to.be.equal(2);

    // Slow each worker's onRequest so both broadcasts are genuinely
    // in-flight at the same time — this is where a request-id or
    // routing bug would mix the two response streams.
    for (const w of LogWorker.workers) {
      const base = w.onRequest.bind(w);
      (w as any).onRequest = async (key: string) => {
        await wait(400);
        return `${key}:${await base(key)}`;
      };
    }

    const senderWorker = LogWorker.workers[0];

    const started = Date.now();
    const [managerResponse, workerResponse] = await Promise.all([
      app1.request('M'),
      senderWorker.request('W'),
    ]);
    const elapsed = Date.now() - started;

    // Both broadcasts should cover all 2 workers, and each worker's reply
    // must carry the key it was asked about — no cross-pollination.
    expect(managerResponse).to.be.deep.equal({
      '7877-4454': 'M:response from 7877-4454',
      '0883-8329': 'M:response from 0883-8329',
    });
    expect(workerResponse).to.be.deep.equal({
      '7877-4454': 'W:response from 7877-4454',
      '0883-8329': 'W:response from 0883-8329',
    });
    // Sanity: they ran concurrently (both in ~400ms) rather than serially
    // (~800ms+). Loose upper bound to stay resilient on slow CI.
    expect(elapsed).to.be.lessThan(3000);

    await app1.shutdown();
    await app2.shutdown();
  }).timeout(30 * 1000);

  it('worker-to-worker direct request is not delivered to other workers', async () => {
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
    const app3 = new App({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Slave,
      obnizClass: DummyObniz,
      database: 'redis',
      instanceName: 'app3',
      databaseConfig: redisAddress,
    });

    const { getListFromObnizCloudStub } = obnizApiStub();
    getListFromObnizCloudStub.returns([deviceA, deviceB, deviceC]);

    await app1.startWait({ express: false });
    await app2.startWait({ express: false });
    await app3.startWait({ express: false });
    await wait(10000);

    expect(LogWorker.workers.length).to.be.equal(3);

    // Count onRequest invocations per worker with a spy wrapping the
    // original handler, so we can verify that only the targeted worker
    // actually runs onRequest during a direct request.
    const callCounts = new Map<string, number>();
    for (const w of LogWorker.workers) {
      callCounts.set(w.deviceInfo.id, 0);
      const base = w.onRequest.bind(w);
      (w as any).onRequest = async (key: string) => {
        callCounts.set(
          w.deviceInfo.id,
          (callCounts.get(w.deviceInfo.id) ?? 0) + 1
        );
        return await base(key);
      };
    }

    // Pick a sender on one slave and a target on a different slave.
    const senderWorker = LogWorker.workers.find(
      (w) => (w as any).slave._instanceName === 'app1'
    );
    const targetWorker = LogWorker.workers.find(
      (w) => (w as any).slave._instanceName === 'app3'
    );
    if (!senderWorker || !targetWorker) {
      throw new Error('expected one worker per slave');
    }

    const response = await senderWorker.directRequest(
      targetWorker.deviceInfo.id,
      'ping',
      3000
    );
    expect(response).to.be.deep.equal({
      [targetWorker.deviceInfo.id]: `response from ${targetWorker.deviceInfo.id}`,
    });

    // Only the target's onRequest was invoked — sender and the third
    // worker must not have been touched.
    for (const w of LogWorker.workers) {
      const expected = w === targetWorker ? 1 : 0;
      expect(callCounts.get(w.deviceInfo.id)).to.be.equal(
        expected,
        `worker ${w.deviceInfo.id} expected ${expected} onRequest calls`
      );
    }

    await app1.shutdown();
    await app2.shutdown();
    await app3.shutdown();
  }).timeout(60 * 1000);

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

    const app1 = new App({
      appToken: process.env.AppToken || '',
      workerClass: LogWorker,
      instanceType: AppInstanceType.Master,
      obnizClass: DummyObniz,
      fetcher: fetcherStub,
      database: 'redis',
      instanceName: 'app1',
      databaseConfig: redisAddress,
    });
    expect(LogWorker.workers.length).to.be.equal(0);
    expect(fetcherStub.callCount).to.be.equal(0);

    await app1.startWait({
      express: false,
    });

    await wait(10000);

    expect(fetcherStub.callCount).to.be.equal(1);
    expect(LogWorker.workers.length).to.be.equal(3);

    app1.expressWebhook({} as any, {} as any);
    await wait(3000);

    expect(fetcherStub.callCount).to.be.equal(2);
    expect(LogWorker.workers.length).to.be.equal(2);

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
