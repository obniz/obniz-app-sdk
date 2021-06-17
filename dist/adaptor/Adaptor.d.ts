import { Installed_Device, Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';
export interface ReportMessage {
    toMaster: true;
    instanceName: string;
    action: 'report';
    installIds: string[];
}
export interface ReportRequestMessage {
    toMaster: false;
    instanceName: string;
    action: 'reportRequest';
}
export interface SynchronizeRequestMessage {
    toMaster: false;
    instanceName: string;
    action: 'synchronize';
    installs: InstalledDevice[];
}
export declare type ToMasterMessage = ReportMessage;
export declare type ToSlaveMessage = ReportRequestMessage | SynchronizeRequestMessage;
export declare type MessageBetweenInstance = ToMasterMessage | ToSlaveMessage;
/**
 * 一方向性のリスト同期
 * Masterからは各Instanceへ分割されたリストを同期
 * Slaveからはping情報の送信のみ
 * Cassandraと同じく「時間が経てば正しくなる」方式を採用。
 */
export declare abstract class Adaptor {
    isMaster: boolean;
    id: string;
    onReportRequest?: () => Promise<void>;
    onSynchronize?: (installs: InstalledDevice[]) => Promise<void>;
    onReported?: (instanceName: string, installIds: string[]) => Promise<void>;
    onRequestRequested?: (key: string) => Promise<{
        [key: string]: string;
    }>;
    constructor(id: string, isMaster: boolean);
    request(key: string): Promise<{
        [key: string]: string;
    }>;
    protected _onMasterMessage(message: ToMasterMessage): void;
    protected _onSlaveMessage(message: ToSlaveMessage): void;
    protected _onReady(): void;
    onMessage(message: MessageBetweenInstance): void;
    reportRequest(): Promise<void>;
    report(instanceName: string, installIds: string[]): Promise<void>;
    synchronize(instanceName: string, installs: Installed_Device[]): Promise<void>;
    protected abstract _send(json: MessageBetweenInstance): Promise<void>;
}
