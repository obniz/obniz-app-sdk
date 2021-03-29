import { Installed_Device } from "obniz-cloud-sdk/sdk";
/**
 * 一方向性のリスト同期
 * Masterからは各Instanceへ分割されたリストを同期
 * Slaveからはping情報の送信のみ
 * Cassandraと同じく「時間が経てば正しくなる」方式を採用。
 */
export default class Adaptor {
    onReportRequest?: () => Promise<void>;
    onSynchronize?: (installs: Installed_Device[]) => Promise<void>;
    onReported?: (instanceName: string, installIds: string[]) => Promise<void>;
    constructor();
    synchronize(instanceName: string, installs: Installed_Device[]): Promise<void>;
    reportRequest(): Promise<void>;
    report(instanceName: string, installIds: string[]): Promise<void>;
}
