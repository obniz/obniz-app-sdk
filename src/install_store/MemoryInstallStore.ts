import { MemoryWorkerStore } from '../worker_store/MemoryWorkerStore';
import { WorkerInstance } from '../worker_store/WorkerStoreBase';
import {
  InstallStatus,
  InstallStoreBase,
  ManagedInstall,
} from './InstallStoreBase';
import { Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';

export class MemoryInstallStore extends InstallStoreBase {
  private _workerStore: MemoryWorkerStore;
  private _installs: { [id: string]: ManagedInstall } = {};

  constructor(store: MemoryWorkerStore) {
    super();
    this._workerStore = store;
  }

  public get(id: string): Promise<ManagedInstall | undefined> {
    return new Promise((r) => r(this._installs[id]));
  }

  public async getMany(
    ids: string[]
  ): Promise<{ [id: string]: ManagedInstall | undefined }> {
    const installs: { [id: string]: ManagedInstall | undefined } = {};
    for (const id of ids) {
      installs[id] = this._installs[id];
    }
    return installs;
  }

  public getByWorker(name: string): Promise<{ [id: string]: ManagedInstall }> {
    const installs: { [id: string]: ManagedInstall } = {};
    for (const [id, install] of Object.entries(this._installs)) {
      if (install.instanceName === name) installs[id] = install;
    }
    return new Promise((r) => r(installs));
  }

  public getAll(): Promise<{ [id: string]: ManagedInstall }> {
    return new Promise((r) => r(this._installs));
  }

  private async getBestWorkerInstance(
    exceptInstanceName: string[] = []
  ): Promise<WorkerInstance | null> {
    const installCounts: any = {};
    const instances = await this._workerStore.getAllWorkerInstances();
    for (const name in instances) {
      installCounts[name] = 0;
    }
    for (const obnizId in this._installs) {
      const managedInstall = this._installs[obnizId];
      if (installCounts[managedInstall.instanceName] === undefined) continue;
      installCounts[managedInstall.instanceName] += 1;
    }
    let minNumber = 1000 * 1000;
    let minInstance: WorkerInstance | null = null;
    for (const key in installCounts) {
      if (exceptInstanceName.includes(key)) continue;
      if (installCounts[key] < minNumber) {
        minInstance = instances[key];
        minNumber = installCounts[key];
      }
    }
    return minInstance;
  }

  public async autoCreate(
    id: string,
    device: InstalledDevice
  ): Promise<ManagedInstall | null> {
    const worker = await this.getBestWorkerInstance();
    if (!worker) throw new Error('NO_AVAILABLE_WORKER');
    return this.manualCreate(id, {
      instanceName: worker.name,
      install: device,
      status: InstallStatus.Starting,
      updatedMillisecond: Date.now(),
    });
  }

  public manualCreate(
    id: string,
    install: ManagedInstall
  ): Promise<ManagedInstall> {
    this._installs[id] = install;
    return new Promise((r) => r(this._installs[id]));
  }

  public async autoRelocate(
    id: string,
    force = false
  ): Promise<ManagedInstall | null> {
    const nowInstall = await this.get(id);
    if (!nowInstall) throw new Error('INSTALL_NOT_FOUND');
    const worker = await this.getBestWorkerInstance([nowInstall.instanceName]);
    if (!worker) throw new Error('NO_AVAILABLE_WORKER');
    return this.update(id, {
      instanceName: worker.name,
      status: InstallStatus.Starting,
    });
  }

  public update(
    id: string,
    props: Partial<ManagedInstall>
  ): Promise<ManagedInstall> {
    this._installs[id] = {
      install: props.install ?? this._installs[id].install,
      instanceName: props.instanceName ?? this._installs[id].instanceName,
      status: props.status ?? this._installs[id].status,
      updatedMillisecond:
        props.updatedMillisecond ?? this._installs[id].updatedMillisecond,
    };
    return new Promise((r) => r(this._installs[id]));
  }

  public remove(id: string): Promise<void> {
    delete this._installs[id];
    return new Promise((r) => r());
  }
}
