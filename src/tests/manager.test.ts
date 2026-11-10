import { after, afterEach, before, beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import IORedis from 'ioredis';
import sinon from 'sinon';
import '../App';
import { Manager } from '../Manager';
import { Adaptor } from '../adaptor/Adaptor';
import { MemoryAdaptor } from '../adaptor/MemoryAdaptor';
import { RedisAdaptor } from '../adaptor/RedisAdaptor';
import { MemoryInstallStore } from '../install_store/MemoryInstallStore';
import { RedisInstallStore } from '../install_store/RedisInstallStore';
import { DeviceInfo } from '../types/device';
import { MemoryWorkerStore } from '../worker_store/MemoryWorkerStore';
import { RedisWorkerStore } from '../worker_store/RedisWorkerStore';

interface ManagerInternals {
  _workerStore: MemoryWorkerStore | RedisWorkerStore;
  _installStore: MemoryInstallStore | RedisInstallStore;
  onInstanceMissed(instanceName: string): Promise<void>;
  synchronize(): Promise<void>;
}

const redisAddress = process.env.REDIS_URL;
if (!redisAddress)
  throw new Error('REDIS_URL is required to run manager tests');

const source = 'source';
const destination = 'destination';
const sourceHeartbeat = `slave:${source}:heartbeat`;
const sourceAssignments = `workers:${source}`;
const firstDevice: DeviceInfo = {
  id: '0000-0001',
  hardware: 'esp32w',
  configs: '{}',
};
const secondDevice: DeviceInfo = {
  id: '0000-0002',
  hardware: 'esp32w',
  configs: '{}',
};

function createManager(adaptor: Adaptor): ManagerInternals {
  const manager = new Manager({
    appToken: '',
    instanceName: 'manager',
    adaptor,
    obnizSdkOption: {},
  }) as unknown as ManagerInternals;
  sinon.stub(manager, 'synchronize').resolves();
  return manager;
}

describe('manager lost worker cleanup', () => {
  afterEach(() => sinon.restore());

  describe('Redis assignments', () => {
    let redis: IORedis;
    let manager: ManagerInternals;

    before(() => {
      redis = new IORedis(redisAddress);
    });

    after(async () => {
      await redis.quit();
    });

    beforeEach(async () => {
      await redis.flushdb();
      const adaptor = sinon.createStubInstance(RedisAdaptor);
      adaptor.getRedisInstance.returns(redis);
      manager = createManager(adaptor);
      await redis.set(`slave:${destination}:heartbeat`, Date.now(), 'EX', 20);
      for (const device of [firstDevice, secondDevice]) {
        await manager._installStore.manualCreate(device.id, {
          instanceName: source,
          install: device,
          updatedMillisecond: Date.now(),
        });
      }
    });

    it('preserves assignments and heartbeat when the worker has recovered', async () => {
      await redis.set(sourceHeartbeat, Date.now(), 'EX', 20);

      await manager.onInstanceMissed(source);

      expect(await redis.hkeys(sourceAssignments)).to.have.members([
        firstDevice.id,
        secondDevice.id,
      ]);
      expect(await redis.exists(sourceHeartbeat)).to.equal(1);
      expect(await redis.hlen(`workers:${destination}`)).to.equal(0);
      sinon.assert.calledOnce(manager.synchronize as sinon.SinonStub);
    });

    it('retains skipped assignments after recovering during relocation', async () => {
      const store = manager._installStore;
      const relocate = store.autoRelocate.bind(store);
      let calls = 0;
      sinon.stub(store, 'autoRelocate').callsFake(async (id, force) => {
        calls++;
        if (calls === 2) await redis.set(sourceHeartbeat, Date.now(), 'EX', 20);
        return relocate(id, force);
      });

      await manager.onInstanceMissed(source);

      const retained = await redis.hkeys(sourceAssignments);
      const moved = await redis.hkeys(`workers:${destination}`);
      expect(retained).to.have.length(1);
      expect(moved).to.have.length(1);
      expect([...retained, ...moved]).to.have.members([
        firstDevice.id,
        secondDevice.id,
      ]);
      expect(await redis.exists(sourceHeartbeat)).to.equal(1);
    });

    it('relocates every assignment when the worker stays offline', async () => {
      await manager.onInstanceMissed(source);

      expect(await redis.exists(sourceAssignments)).to.equal(0);
      expect(await redis.exists(sourceHeartbeat)).to.equal(0);
      expect(await redis.hkeys(`workers:${destination}`)).to.have.members([
        firstDevice.id,
        secondDevice.id,
      ]);
    });

    it('preserves a heartbeat renewed after the final relocation', async () => {
      const store = manager._installStore;
      const relocate = store.autoRelocate.bind(store);
      let calls = 0;
      sinon.stub(store, 'autoRelocate').callsFake(async (id, force) => {
        const result = await relocate(id, force);
        if (++calls === 2)
          await redis.set(sourceHeartbeat, Date.now(), 'EX', 20);
        return result;
      });

      await manager.onInstanceMissed(source);

      expect(await redis.hlen(`workers:${destination}`)).to.equal(2);
      expect(await redis.exists(sourceAssignments)).to.equal(0);
      expect(await redis.exists(sourceHeartbeat)).to.equal(1);
    });

    it('skips relocation and retains assignments when no live worker exists', async () => {
      await redis.del(`slave:${destination}:heartbeat`);
      const relocate = sinon.spy(manager._installStore, 'autoRelocate');

      await manager.onInstanceMissed(source);

      sinon.assert.notCalled(relocate);
      sinon.assert.notCalled(manager.synchronize as sinon.SinonStub);
      expect(await redis.hkeys(sourceAssignments)).to.have.members([
        firstDevice.id,
        secondDevice.id,
      ]);
    });

    it('retains skipped assignments even if the heartbeat disappears before cleanup', async () => {
      const store = manager._installStore;
      const relocate = store.autoRelocate.bind(store);
      let calls = 0;
      sinon.stub(store, 'autoRelocate').callsFake(async (id, force) => {
        if (++calls === 2) {
          await redis.set(sourceHeartbeat, Date.now(), 'EX', 20);
          try {
            return await relocate(id, force);
          } finally {
            await redis.del(sourceHeartbeat);
          }
        }
        return relocate(id, force);
      });

      await manager.onInstanceMissed(source);

      expect(await redis.exists(sourceHeartbeat)).to.equal(0);
      expect(await redis.hlen(sourceAssignments)).to.equal(1);
      expect(await redis.hlen(`workers:${destination}`)).to.equal(1);
      expect(Object.keys(await store.getAll())).to.have.members([
        firstDevice.id,
        secondDevice.id,
      ]);
    });

    it('preserves an assignment added after the final relocation', async () => {
      const store = manager._installStore;
      const relocate = store.autoRelocate.bind(store);
      const newDevice = { ...firstDevice, id: '0000-0003' };
      let calls = 0;
      sinon.stub(store, 'autoRelocate').callsFake(async (id, force) => {
        const result = await relocate(id, force);
        if (++calls === 2) {
          await store.manualCreate(newDevice.id, {
            instanceName: source,
            install: newDevice,
            updatedMillisecond: Date.now(),
          });
        }
        return result;
      });

      await manager.onInstanceMissed(source);

      expect(await redis.hkeys(sourceAssignments)).to.have.members([
        newDevice.id,
      ]);
      expect(await redis.hkeys(`workers:${destination}`)).to.have.members([
        firstDevice.id,
        secondDevice.id,
      ]);
    });
  });

  it('skips relocation and preserves an in-memory worker when no live worker exists', async () => {
    const manager = createManager(sinon.createStubInstance(MemoryAdaptor));
    const workers = manager._workerStore as MemoryWorkerStore;
    workers.addWorkerInstance(source, {
      installIds: [firstDevice.id],
      updatedMillisecond: 0,
    });
    await manager._installStore.manualCreate(firstDevice.id, {
      instanceName: source,
      install: firstDevice,
      updatedMillisecond: 0,
    });

    const relocate = sinon.spy(manager._installStore, 'autoRelocate');

    await manager.onInstanceMissed(source);

    sinon.assert.notCalled(relocate);
    sinon.assert.notCalled(manager.synchronize as sinon.SinonStub);
    expect(await workers.getWorkerInstance(source)).not.to.equal(undefined);
    expect(
      (await manager._installStore.get(firstDevice.id))?.instanceName
    ).to.equal(source);
  });

  it('preserves an in-memory heartbeat renewed during the final relocation', async () => {
    let now = 100000;
    sinon.stub(Date, 'now').callsFake(() => now);
    const manager = createManager(sinon.createStubInstance(MemoryAdaptor));
    const workers = manager._workerStore as MemoryWorkerStore;
    workers.addWorkerInstance(source, {
      installIds: [firstDevice.id],
      updatedMillisecond: 0,
    });
    workers.addWorkerInstance(destination, {
      installIds: [],
      updatedMillisecond: Date.now(),
    });
    const store = manager._installStore;
    await store.manualCreate(firstDevice.id, {
      instanceName: source,
      install: firstDevice,
      updatedMillisecond: 0,
    });
    const relocate = store.autoRelocate.bind(store);
    const heartbeat = Date.now();
    sinon.stub(store, 'autoRelocate').callsFake(async (id, force) => {
      const result = await relocate(id, force);
      workers.updateWorkerInstance(source, { updatedMillisecond: heartbeat });
      now += 60000;
      return result;
    });

    await manager.onInstanceMissed(source);

    expect(
      (await workers.getWorkerInstance(source))?.updatedMillisecond
    ).to.equal(heartbeat);
    expect((await store.get(firstDevice.id))?.instanceName).to.equal(
      destination
    );
  });

  it('still removes an offline in-memory worker after relocation', async () => {
    const manager = createManager(sinon.createStubInstance(MemoryAdaptor));
    const workers = manager._workerStore as MemoryWorkerStore;
    workers.addWorkerInstance(source, {
      installIds: [firstDevice.id],
      updatedMillisecond: 0,
    });
    workers.addWorkerInstance(destination, {
      installIds: [],
      updatedMillisecond: Date.now(),
    });
    await manager._installStore.manualCreate(firstDevice.id, {
      instanceName: source,
      install: firstDevice,
      updatedMillisecond: 0,
    });

    await manager.onInstanceMissed(source);

    expect(await workers.getWorkerInstance(source)).to.equal(undefined);
    expect(
      (await manager._installStore.get(firstDevice.id))?.instanceName
    ).to.equal(destination);
    sinon.assert.calledOnce(manager.synchronize as sinon.SinonStub);
  });

  describe('in-memory relocation finalization', () => {
    it('uses authoritative assignments even when the worker reports none', async () => {
      const workers = new MemoryWorkerStore();
      const installs = new MemoryInstallStore(workers);
      workers.addWorkerInstance(source, {
        installIds: [],
        updatedMillisecond: 0,
      });
      await installs.manualCreate(firstDevice.id, {
        instanceName: source,
        install: firstDevice,
        updatedMillisecond: 0,
      });

      await installs.finalizeWorkerRelocation(source, 1000);

      expect(await workers.getWorkerInstance(source)).not.to.equal(undefined);
      expect((await installs.get(firstDevice.id))?.instanceName).to.equal(
        source
      );
    });

    for (const heartbeat of [999, 1000, 1001]) {
      it(`only removes an unassigned worker whose heartbeat ${heartbeat} predates cutoff 1000`, async () => {
        const workers = new MemoryWorkerStore();
        const installs = new MemoryInstallStore(workers);
        // Reports can still list an install after its ownership has moved.
        workers.addWorkerInstance(source, {
          installIds: [firstDevice.id],
          updatedMillisecond: heartbeat,
        });

        await installs.finalizeWorkerRelocation(source, 1000);

        const worker = await workers.getWorkerInstance(source);
        if (heartbeat < 1000) {
          expect(worker).to.equal(undefined);
        } else {
          expect(worker?.updatedMillisecond).to.equal(heartbeat);
        }
      });
    }
  });
});
