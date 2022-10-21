import { Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';
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
declare type Message<ActionName extends MessageKeys> = {
    action: ActionName;
    info: {
        instanceName: string;
        toMaster: boolean;
        sendMode: 'direct';
    } | {
        toMaster: false;
        sendMode: 'broadcast';
    };
} & {
    body: MessageBodies[ActionName];
};
export declare type Messages<T extends string> = T extends MessageKeys ? Message<T> : never;
export declare type MessagesUnion = Messages<MessageKeys>;
export declare const isValidMessage: (mes: any) => mes is Message<"report"> | Message<"reportRequest"> | Message<"synchronize"> | Message<"keyRequest"> | Message<"keyRequestResponse">;
export {};
