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

// https://github.com/microsoft/TypeScript/issues/27024#issuecomment-421529650
type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y
  ? 1
  : 2
  ? true
  : false;
type TrueCheck<T extends true> = T;

const MessageKeysArray = [
  'report',
  'reportRequest',
  'synchronize',
  'keyRequest',
  'keyRequestResponse',
] as const;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _MessageKeyCheck = TrueCheck<
  Equals<typeof MessageKeysArray[number], MessageKeys>
>;

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
