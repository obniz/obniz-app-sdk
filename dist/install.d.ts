import { Installed_Device } from 'obniz-cloud-sdk/sdk';
export declare class InstalledDeviceManager {
    getListFromObnizCloud(token: string): Promise<Installed_Device[]>;
}
export declare const sharedInstalledDeviceManager: InstalledDeviceManager;
