import { MemoryWorkerStore } from '../worker_store/MemoryWorkerStore';
import { InstallStoreBase, ManagedInstall } from './InstallStoreBase';
import { Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';
export declare class MemoryInstallStore extends InstallStoreBase {
    private _workerStore;
    private _installs;
    constructor(store: MemoryWorkerStore);
    get(id: string): Promise<ManagedInstall | undefined>;
    getMany(ids: string[]): Promise<{
        [id: string]: ManagedInstall | undefined;
    }>;
    getByWorker(name: string): Promise<{
        [id: string]: ManagedInstall;
    }>;
    getAll(): Promise<{
        [id: string]: ManagedInstall;
    }>;
    private getBestWorkerInstance;
    autoCreate(id: string, device: InstalledDevice): Promise<ManagedInstall>;
    manualCreate(id: string, install: ManagedInstall): Promise<ManagedInstall>;
    autoRelocate(id: string, force?: boolean): Promise<ManagedInstall>;
    update(id: string, props: Partial<ManagedInstall>): Promise<ManagedInstall>;
    remove(id: string): Promise<void>;
}
