import { Installed_Device as InstalledDevice } from "obniz-cloud-sdk/sdk";
/**
 * 一方向性のリスト同期
 * Masterからは各Instanceへ分割されたリストを同期
 * Slaveからはping情報の送信のみ
 * Cassandraと同じく「時間が経てば正しくなる」方式を採用。
 */
export declare class Adaptor {
    onReportRequest?: () => Promise<void>;
    onSynchronize?: (installs: InstalledDevice[]) => Promise<void>;
    onReported?: (instanceName: string, installIds: string[]) => Promise<void>;
    onRequestRequested?: (key: string) => Promise<{
        [key: string]: string;
    }>;
    constructor();
    synchronize(instanceName: string, installs: InstalledDevice[]): Promise<void>;
    reportRequest(): Promise<void>;
    report(instanceName: string, installIds: string[]): Promise<void>;
    request(key: string): Promise<{
        [key: string]: string;
    }>;
}
