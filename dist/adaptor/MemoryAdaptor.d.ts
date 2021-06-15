import { Installed_Device } from 'obniz-cloud-sdk/sdk';
import { Adaptor } from './Adaptor';
export interface MemoryAdaptorOptions {
    limit: number;
}
export declare class MemoryAdaptor extends Adaptor {
    isMaster: boolean;
    id: string;
    readonly options: MemoryAdaptorOptions;
    constructor(id: string, isMaster: boolean, options: MemoryAdaptorOptions);
    onReady(): Promise<void>;
    onMessage(message: string): Promise<void>;
    send(json: any): Promise<void>;
    synchronize(instanceName: string, installs: Installed_Device[]): Promise<void>;
    reportRequest(): Promise<void>;
    report(instanceName: string, installIds: string[]): Promise<void>;
}
