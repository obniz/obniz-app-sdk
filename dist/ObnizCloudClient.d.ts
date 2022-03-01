import { SdkOption } from 'obniz-cloud-sdk';
import { AppEventsQuery, Installed_Device } from 'obniz-cloud-sdk/sdk';
export declare type AppEvent = NonNullable<NonNullable<AppEventsQuery['appEvents']>['events'][number]>;
export declare class ObnizCloudClient {
    getListFromObnizCloud(token: string, option: SdkOption): Promise<Installed_Device[]>;
    getDiffListFromObnizCloud(token: string, option: SdkOption, skip: number): Promise<{
        appEvents: AppEvent[];
        maxId: number;
    }>;
    getCurrentEventNo(token: string, option: SdkOption): Promise<number>;
}
export declare const obnizCloudClientInstance: ObnizCloudClient;
