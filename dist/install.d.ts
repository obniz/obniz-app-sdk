import { SdkOption } from 'obniz-cloud-sdk';
import { Installed_Device } from 'obniz-cloud-sdk/sdk';
export declare class InstalledDeviceManager {
    getListFromObnizCloud(token: string, option: SdkOption): Promise<Installed_Device[]>;
}
export declare const sharedInstalledDeviceManager: InstalledDeviceManager;
