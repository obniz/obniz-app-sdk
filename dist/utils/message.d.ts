import { Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';
import { UnionOmit } from './common';
export declare type MessageBodies = {
    report: {
        installIds: string[];
    };
    reportRequest: Record<string, never>;
    synchronize: {
        syncType: 'redis';
    } | {
        syncType: 'list';
        installs: InstalledDevice[];
    };
    keyRequest: {
        obnizId?: string;
        requestId: string;
        key: string;
    };
    keyRequestResponse: {
        results: {
            [key: string]: string;
        };
        requestId: string;
    };
};
export declare type MessageKeys = keyof MessageBodies;
export declare type MessageInfo = {
    to: string;
    toManager: boolean;
    sendMode: 'direct';
    from: string;
} | {
    toManager: boolean;
    sendMode: 'broadcast';
    from: string;
};
export declare type MessageInfoOmitFrom = UnionOmit<Message<'report'>['info'], 'from'>;
export declare type Message<ActionName extends MessageKeys> = {
    action: ActionName;
    info: MessageInfo;
} & {
    body: MessageBodies[ActionName];
};
export declare type Messages<T extends string> = T extends MessageKeys ? Message<T> : never;
export declare type MessagesUnion = Messages<MessageKeys>;
export declare const isValidMessage: (mes: any) => mes is Message<"report"> | Message<"reportRequest"> | Message<"synchronize"> | Message<"keyRequest"> | Message<"keyRequestResponse">;
