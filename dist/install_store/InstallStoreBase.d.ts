import { Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';
export declare enum InstallStatus {
    Starting = 0,
    Started = 1,
    Stopping = 2,
    Stopped = 3
}
export interface ManagedInstall {
    instanceName: string;
    install: InstalledDevice;
    status: InstallStatus;
    updatedMillisecond: number;
}
export declare abstract class InstallStoreBase {
    abstract getAllInstalls(): Promise<{
        [id: string]: ManagedInstall;
    }>;
    abstract createInstall(id: string, install: ManagedInstall): Promise<ManagedInstall>;
    abstract updateInstall(id: string, props: Partial<ManagedInstall>): Promise<ManagedInstall>;
    abstract removeInstall(id: string): Promise<void>;
}
