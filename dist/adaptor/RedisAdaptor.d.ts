import { Installed_Device } from 'obniz-cloud-sdk/sdk';
import { Adaptor } from './Adaptor';
import IORedis from 'ioredis';
export declare class RedisAdaptor extends Adaptor {
    isMaster: boolean;
    id: string;
    private _redis;
    private _pubRedis;
    constructor(id: string, isMaster: boolean, redisOption: IORedis.RedisOptions);
    send(json: any): Promise<void>;
    synchronize(instanceName: string, installs: Installed_Device[]): Promise<void>;
    reportRequest(): Promise<void>;
    report(instanceName: string, installIds: string[]): Promise<void>;
}
