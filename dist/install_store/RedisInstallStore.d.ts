import { Installed_Device } from 'obniz-cloud-sdk/sdk';
import { RedisAdaptor } from '../adaptor/RedisAdaptor';
import { InstallStoreBase, ManagedInstall } from './InstallStoreBase';
export declare class RedisInstallStore extends InstallStoreBase {
    private _redisAdaptor;
    constructor(adaptor: RedisAdaptor);
    get(id: string): Promise<ManagedInstall | undefined>;
    getByWorker(name: string): Promise<{
        [id: string]: ManagedInstall;
    }>;
    getAll(): Promise<{
        [id: string]: ManagedInstall;
    }>;
    autoCreate(id: string, device: Installed_Device): Promise<ManagedInstall>;
    manualCreate(id: string, install: ManagedInstall): Promise<ManagedInstall>;
    autoRelocate(id: string): Promise<ManagedInstall>;
    update(id: string, props: Partial<ManagedInstall>): Promise<ManagedInstall>;
    remove(id: string): Promise<void>;
}
