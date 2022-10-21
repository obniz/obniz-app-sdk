import { MessageBodies, MessagesUnion } from '../utils/message';
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
    onKeyRequest?: (requestId: string, key: string, obnizId?: string) => Promise<void>;
    onKeyRequestResponse?: (requestId: string, instanceName: string, results: {
        [key: string]: string;
    }) => Promise<void>;
    onSynchronize?: (options: MessageBodies['synchronize']) => Promise<void>;
    onReported?: (instanceName: string, installIds: string[]) => Promise<void>;
    constructor(id: string, isMaster: boolean);
    protected _onReady(): void;
    onMessage(mes: MessagesUnion): Promise<void>;
    protected _onSlaveMessage(mes: MessagesUnion): Promise<void>;
    protected _onMasterMessage(mes: MessagesUnion): Promise<void>;
    reportRequest(): Promise<void>;
    report(instanceName: string, installIds: string[]): Promise<void>;
    keyRequest(key: string, requestId: string): Promise<void>;
    directKeyRequest(obnizId: string, instanceName: string, key: string, requestId: string): Promise<void>;
    keyRequestResponse(requestId: string, instanceName: string, results: {
        [key: string]: string;
    }): Promise<void>;
    synchronizeRequest(options: MessageBodies['synchronize']): Promise<void>;
    protected abstract _sendMessage(data: MessagesUnion): Promise<void>;
}
