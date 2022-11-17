import { Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';
import { UnionOmit } from './common';

export type MessageBodies = {
  report: {
    installIds: string[];
  };
  reportRequest: Record<string, never>;
  synchronize:
    | {
        syncType: 'redis';
      }
    | {
        syncType: 'list';
        installs: InstalledDevice[];
      };
  keyRequest: {
    obnizId?: string;
    requestId: string;
    key: string;
  };
  keyRequestResponse: {
    results: { [key: string]: string };
    requestId: string;
  };
};

export type MessageKeys = keyof MessageBodies;

// Waiting for @typescript-eslint/parser to support version ts 4.9
const MessageKeysArray = [
  'report',
  'reportRequest',
  'synchronize',
  'keyRequest',
  'keyRequestResponse',
] satisfies Array<keyof MessageBodies>;

export type MessageInfo =
  | {
      to: string;
      toManager: boolean;
      sendMode: 'direct';
      from: string;
    }
  | {
      toManager: boolean;
      sendMode: 'broadcast';
      from: string;
    };

export type MessageInfoOmitFrom = UnionOmit<Message<'report'>['info'], 'from'>;

export type Message<ActionName extends MessageKeys> = {
  action: ActionName;
  info: MessageInfo;
} & { body: MessageBodies[ActionName] };

export type Messages<T extends string> = T extends MessageKeys
  ? Message<T>
  : never;

export type MessagesUnion = Messages<MessageKeys>;

export const isValidMessage = (mes: any): mes is Messages<MessageKeys> => {
  return mes.action !== undefined && MessageKeysArray.includes(mes.action);
};
