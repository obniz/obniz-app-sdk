import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { RedisMemoryServer } from 'redis-memory-server';
// Import App first so the App<->Adaptor module cycle initializes in the same
// order as the other test files before touching the adaptor/store directly.
import { AppInstanceType } from '../App';
import { RedisAdaptor, RedisAdaptorOptions } from '../adaptor/RedisAdaptor';
import { RedisInstallStore } from '../install_store/RedisInstallStore';
import { DeviceInfo } from '../types/device';

/**
 * Deterministic, app-timing-free tests for the bulk install-store logic that
 * powers fast startup with large device counts. These talk to a real Redis
 * (redis-memory-server) but bypass the App/Manager/Slave timing machinery.
 */
describe('RedisInstallStore bulk', () => {
  let redisServer: RedisMemoryServer;
  let redisAddress: string;
  let adaptor: RedisAdaptor;
  let store: RedisInstallStore;

  beforeEach(async () => {
    redisServer = new RedisMemoryServer();
    redisAddress = `redis://${await redisServer.getHost()}:${await redisServer.getPort()}`;
    // The address string is passed through the same way the AdaptorFactory
    // does for `databaseConfig` (cast to RedisAdaptorOptions).
    adaptor = new RedisAdaptor(
      'tester',
      AppInstanceType.Manager,
      redisAddress as unknown as RedisAdaptorOptions
    );
    store = new RedisInstallStore(adaptor);
    await adaptor.getRedisInstance().flushall();
  });

  afterEach(async () => {
    await adaptor.shutdown();
    if (redisServer) await redisServer.stop();
  });

  const makeDevice = (id: string): DeviceInfo =>
    ({
      id,
      hardware: 'obnizb1',
      configs: '{}',
    }) as DeviceInfo;

  async function registerSlaves(names: string[]) {
    const redis = adaptor.getRedisInstance();
    for (const name of names) {
      await redis.set(`slave:${name}:heartbeat`, Date.now(), 'EX', 20);
    }
  }

  it('bulkCreate balances devices across slaves', async () => {
    await registerSlaves(['s1', 's2', 's3']);
    const devices: DeviceInfo[] = [];
    for (let i = 0; i < 30; i++) {
      devices.push(makeDevice(`0000-${String(i).padStart(4, '0')}`));
    }

    const created = await store.bulkCreate(devices);
    expect(created.length).to.equal(30);

    const all = await store.getAll();
    expect(Object.keys(all).length).to.equal(30);

    // Count per slave — should be evenly balanced (10/10/10).
    const counts: { [name: string]: number } = {};
    for (const id in all) {
      const name = all[id].instanceName;
      counts[name] = (counts[name] ?? 0) + 1;
    }
    expect(counts.s1).to.equal(10);
    expect(counts.s2).to.equal(10);
    expect(counts.s3).to.equal(10);
  }).timeout(30000);

  it('bulkCreate skips already-installed devices', async () => {
    await registerSlaves(['s1', 's2']);
    const devices = [makeDevice('0000-0001'), makeDevice('0000-0002')];
    await store.bulkCreate(devices);

    // Re-run with an overlap + one new device.
    const second = await store.bulkCreate([
      makeDevice('0000-0001'), // already installed -> skipped
      makeDevice('0000-0003'), // new
    ]);
    expect(second.map((m) => m.install.id)).to.deep.equal(['0000-0003']);

    const all = await store.getAll();
    expect(Object.keys(all).sort()).to.deep.equal([
      '0000-0001',
      '0000-0002',
      '0000-0003',
    ]);
  }).timeout(30000);

  it('bulkCreate throws NO_ACCEPTABLE_WORKER when no slaves', async () => {
    let threw: Error | undefined;
    try {
      await store.bulkCreate([makeDevice('0000-0001')]);
    } catch (e) {
      threw = e as Error;
    }
    expect(threw?.message).to.equal('NO_ACCEPTABLE_WORKER');
  }).timeout(30000);

  it('bulkCreate spans multiple chunks (>100 devices)', async () => {
    await registerSlaves(['s1', 's2']);
    const devices: DeviceInfo[] = [];
    for (let i = 0; i < 250; i++) {
      devices.push(makeDevice(`0001-${String(i).padStart(4, '0')}`));
    }
    const created = await store.bulkCreate(devices);
    expect(created.length).to.equal(250);

    const all = await store.getAll();
    expect(Object.keys(all).length).to.equal(250);

    const counts: { [name: string]: number } = {};
    for (const id in all) {
      counts[all[id].instanceName] = (counts[all[id].instanceName] ?? 0) + 1;
    }
    // Balanced within a small tolerance across chunk boundaries.
    expect(Math.abs(counts.s1 - counts.s2)).to.be.lessThanOrEqual(2);
  }).timeout(30000);

  it('getMany resolves requested ids efficiently', async () => {
    await registerSlaves(['s1', 's2', 's3']);
    const devices: DeviceInfo[] = [];
    for (let i = 0; i < 20; i++) {
      devices.push(makeDevice(`0002-${String(i).padStart(4, '0')}`));
    }
    await store.bulkCreate(devices);

    const wanted = ['0002-0000', '0002-0010', '0002-0019', 'nonexistent'];
    const got = await store.getMany(wanted);
    expect(got['0002-0000']?.install.id).to.equal('0002-0000');
    expect(got['0002-0010']?.install.id).to.equal('0002-0010');
    expect(got['0002-0019']?.install.id).to.equal('0002-0019');
    expect(got.nonexistent).to.equal(undefined);
  }).timeout(30000);
});
