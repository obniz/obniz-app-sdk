import { Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';
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
export declare type SynchronizeByListRequestMessage = {
    toMaster: false;
    instanceName: string;
    action: 'synchronize';
    syncType: 'list';
    installs: InstalledDevice[];
};
export declare type SynchronizeByRedisRequestMessage = {
    toMaster: false;
    instanceName: string;
    action: 'synchronize';
    syncType: 'redis';
};
declare type SynchronizeByListParams = Pick<SynchronizeByListRequestMessage, 'syncType' | 'installs'>;
declare type SynchronizeByRedisParams = Pick<SynchronizeByRedisRequestMessage, 'syncType'>;
export declare type SynchronizeMethodOption = SynchronizeByListParams | SynchronizeByRedisParams;
export declare type SynchronizeRequestMessage = SynchronizeByListRequestMessage | SynchronizeByRedisRequestMessage;
export declare type SynchronizeRequestType = SynchronizeRequestMessage['syncType'];
export interface KeyRequestMessage {
    toMaster: false;
    instanceName: string;
    action: 'keyRequest';
    key: string;
    requestId: string;
}
export interface KeyRequestResponseMessage {
    toMaster: true;
    instanceName: string;
    action: 'keyRequestResponse';
    results: {
        [key: string]: string;
    };
    requestId: string;
}
export declare type ToMasterMessage = ReportMessage | KeyRequestResponseMessage;
export declare type ToSlaveMessage = ReportRequestMessage | SynchronizeRequestMessage | KeyRequestMessage;
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
    isReady: boolean;
    onReportRequest?: () => Promise<void>;
    onKeyRequest?: (requestId: string, key: string) => Promise<void>;
    onKeyRequestResponse?: (requestId: string, instanceName: string, results: {
        [key: string]: string;
    }) => Promise<void>;
    onSynchronize?: (options: SynchronizeMethodOption) => Promise<void>;
    onReported?: (instanceName: string, installIds: string[]) => Promise<void>;
    onRequestRequested?: (key: string) => Promise<{
        [key: string]: string;
    }>;
    constructor(id: string, isMaster: boolean);
    protected _onMasterMessage(message: ToMasterMessage): void;
    protected _onSlaveMessage(message: ToSlaveMessage): void;
    protected _onReady(): void;
    onMessage(message: MessageBetweenInstance): void;
    reportRequest(): Promise<void>;
    report(instanceName: string, installIds: string[]): Promise<void>;
    keyRequest(key: string, requestId: string): Promise<void>;
    keyRequestResponse(requestId: string, instanceName: string, results: {
        [key: string]: string;
    }): Promise<void>;
    synchronize(instanceName: string, options: SynchronizeMethodOption): Promise<void>;
    protected abstract _send(json: MessageBetweenInstance): Promise<void>;
}
export {};
