import { Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';
export interface ManagedInstall {
    instanceName: string;
    install: InstalledDevice;
    updatedMillisecond: number;
}
export declare abstract class InstallStoreBase {
    /**
     * Get an install.
     * @param id obnizId
     */
    abstract get(id: string): Promise<ManagedInstall | undefined>;
    /**
     * Get all installs specified in the ID array.
     */
    abstract getMany(ids: string[]): Promise<{
        [id: string]: ManagedInstall | undefined;
    }>;
    /**
     * Get the Installs on a specific Worker.
     */
    abstract getByWorker(name: string): Promise<{
        [id: string]: ManagedInstall;
    }>;
    /**
     * Get all the installs on the InstallStore.
     */
    abstract getAll(): Promise<{
        [id: string]: ManagedInstall;
    }>;
    /**
     * Automatically selects an optimal Slave and creates an Install.
     * @param id obnizId
     */
    abstract autoCreate(id: string, device: InstalledDevice): Promise<ManagedInstall>;
    /**
     * Create an Install from the data.
     * @param id obnizId
     * @param install Install Data
     */
    abstract manualCreate(id: string, install: ManagedInstall): Promise<ManagedInstall>;
    /**
     * Update the Install data.
     * @param id obnizId
     * @param props Install Data
     */
    abstract update(id: string, props: Partial<ManagedInstall>): Promise<ManagedInstall>;
    /**
     * Automatically relocates the Install.
     * @param id obnizId
     */
    abstract autoRelocate(id: string, force?: boolean): Promise<ManagedInstall>;
    /**
     * Remove Install.
     * @param id obnizId
     */
    abstract remove(id: string): Promise<void>;
}
