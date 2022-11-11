import { AppInstanceType } from '../App';
import { MessageBodies, MessageKeys, MessagesUnion, Message, MessageInfoOmitFrom } from '../utils/message';
/**
 * 一方向性のリスト同期
 * Masterからは各Instanceへ分割されたリストを同期
 * Slaveからはping情報の送信のみ
 * Cassandraと同じく「時間が経てば正しくなる」方式を採用。
 */
export declare abstract class Adaptor {
    instanceType: AppInstanceType;
    isMaster: boolean;
    id: string;
    isReady: boolean;
    onReportRequest?: (masterName: string) => Promise<void>;
    onKeyRequest?: (masterName: string, requestId: string, key: string, obnizId?: string) => Promise<void>;
    onKeyRequestResponse?: (requestId: string, instanceName: string, results: {
        [key: string]: string;
    }) => Promise<void>;
    onSynchronize?: (options: MessageBodies['synchronize']) => Promise<void>;
    onReported?: (instanceName: string, installIds: string[]) => Promise<void>;
    constructor(id: string, instanceType: AppInstanceType);
    protected _onReady(): void;
    onMessage(mes: MessagesUnion): Promise<void>;
    protected _onSlaveMessage(mes: MessagesUnion): Promise<void>;
    protected _onManagerMessage(mes: MessagesUnion): Promise<void>;
    reportRequest(): Promise<void>;
    report(installIds: string[], masterName?: string): Promise<void>;
    keyRequest(key: string, requestId: string): Promise<void>;
    directKeyRequest(obnizId: string, instanceName: string, key: string, requestId: string): Promise<void>;
    keyRequestResponse(masterName: string, requestId: string, results: {
        [key: string]: string;
    }): Promise<void>;
    synchronizeRequest(options: MessageBodies['synchronize']): Promise<void>;
    protected _sendMessage<ActionName extends MessageKeys>(action: ActionName, info: MessageInfoOmitFrom, data: Message<ActionName>['body']): Promise<void>;
    protected abstract _onSendMessage(data: MessagesUnion): Promise<void>;
}
