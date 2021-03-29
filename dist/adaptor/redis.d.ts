import { Installed_Device } from 'obniz-cloud-sdk/sdk';
import Adaptor from './adaptor';
export default class RedisAdaptor extends Adaptor {
    isMaster: boolean;
    id: string;
    private redis;
    private pubRedis;
    constructor(id: string, isMaster: boolean);
    send(json: any): Promise<void>;
    synchronize(instanceName: string, installs: Installed_Device[]): Promise<void>;
    reportRequest(): Promise<void>;
    report(instanceName: string, installIds: string[]): Promise<void>;
}
