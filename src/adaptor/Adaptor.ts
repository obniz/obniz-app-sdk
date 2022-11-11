import { AppInstanceType } from '../App';
import { logger } from '../logger';
import {
  MessageBodies,
  MessageKeys,
  MessagesUnion,
  Message,
  MessageInfoOmitFrom,
} from '../utils/message';

/**
 * 一方向性のリスト同期
 * Masterからは各Instanceへ分割されたリストを同期
 * Slaveからはping情報の送信のみ
 * Cassandraと同じく「時間が経てば正しくなる」方式を採用。
 */
export abstract class Adaptor {
  public instanceType: AppInstanceType;
  public isMaster: boolean;
  public id: string;

  public isReady = false;

  public onReportRequest?: (masterName: string) => Promise<void>;
  public onKeyRequest?: (
    masterName: string,
    requestId: string,
    key: string,
    obnizId?: string
  ) => Promise<void>;
  public onKeyRequestResponse?: (
    requestId: string,
    instanceName: string,
    results: { [key: string]: string }
  ) => Promise<void>;
  public onSynchronize?: (
    options: MessageBodies['synchronize']
  ) => Promise<void>;
  public onReported?: (
    instanceName: string,
    installIds: string[]
  ) => Promise<void>;

  constructor(id: string, instanceType: AppInstanceType) {
    this.id = id;
    this.instanceType = instanceType;
    // For compatibility
    this.isMaster = instanceType !== AppInstanceType.Slave;
  }

  protected _onReady(): void {
    this.isReady = true;
    logger.debug(`ready id: ${this.id} (type: ${this.constructor.name})`);
    if (this.isMaster) {
      this.reportRequest()
        .then(() => {})
        .catch((e) => {
          logger.error(e);
        });
    } else {
      if (this.onReportRequest) {
        this.onReportRequest('unknown')
          .then(() => {})
          .catch((e) => {
            logger.error(e);
          });
      }
    }
  }

  async onMessage(mes: MessagesUnion): Promise<void> {
    if (mes.info.toManager) {
      if (
        this.instanceType === AppInstanceType.Master ||
        this.instanceType === AppInstanceType.Manager
      )
        await this._onManagerMessage(mes);
    } else {
      if (
        this.instanceType === AppInstanceType.Master ||
        this.instanceType === AppInstanceType.Slave
      )
        await this._onSlaveMessage(mes);
    }
  }

  protected async _onSlaveMessage(mes: MessagesUnion): Promise<void> {
    if (mes.info.toManager) return;
    if (mes.info.sendMode === 'direct' && mes.info.to !== this.id) return;
    console.log('SlaveMessageReceived', { mes });
    try {
      if (mes.action === 'synchronize') {
        if (this.onSynchronize) {
          if (mes.body.syncType === 'redis') {
            await this.onSynchronize({
              syncType: mes.body.syncType,
            });
          } else {
            await this.onSynchronize({
              syncType: mes.body.syncType,
              installs: mes.body.installs,
            });
          }
        }
      } else if (mes.action === 'reportRequest') {
        if (this.onReportRequest && mes.info.sendMode === 'direct') {
          await this.onReportRequest(mes.info.to);
        }
      } else if (mes.action === 'keyRequest') {
        if (this.onKeyRequest) {
          await this.onKeyRequest(
            mes.info.from,
            mes.body.requestId,
            mes.body.key,
            mes.body.obnizId
          );
        }
      }
    } catch (e) {
      logger.error(e);
    }
  }

  protected async _onManagerMessage(mes: MessagesUnion): Promise<void> {
    if (!mes.info.toManager) return;
    if (
      mes.info.sendMode === 'direct' && // mes is direct message
      mes.info.to !== undefined && // "to" is set
      mes.info.to !== this.id // "to" is not me
    )
      return;
    console.log('ManagerMessageReceived', { mes });
    try {
      if (mes.action === 'report') {
        if (this.onReported)
          await this.onReported(mes.info.from, mes.body.installIds);
      } else if (mes.action === 'keyRequestResponse') {
        const { requestId, results } = mes.body;
        if (this.onKeyRequestResponse)
          await this.onKeyRequestResponse(requestId, mes.info.from, results);
      }
    } catch (e) {
      logger.error(e);
    }
  }

  async reportRequest(): Promise<void> {
    await this._sendMessage(
      'reportRequest',
      {
        sendMode: 'broadcast',
        toManager: false,
      },
      {}
    );
  }

  async report(installIds: string[], masterName?: string): Promise<void> {
    const info = (
      masterName !== undefined
        ? {
            sendMode: 'direct',
            toManager: true,
            to: masterName,
          }
        : {
            sendMode: 'broadcast',
            toManager: true,
          }
    ) as MessageInfoOmitFrom;
    await this._sendMessage('report', info, {
      installIds,
    });
  }

  async keyRequest(key: string, requestId: string): Promise<void> {
    await this._sendMessage(
      'keyRequest',
      {
        toManager: false,
        sendMode: 'broadcast',
      },
      {
        requestId,
        key,
      }
    );
  }

  async directKeyRequest(
    obnizId: string,
    instanceName: string,
    key: string,
    requestId: string
  ): Promise<void> {
    await this._sendMessage(
      'keyRequest',
      {
        toManager: false,
        sendMode: 'direct',
        to: instanceName,
      },
      {
        obnizId,
        requestId,
        key,
      }
    );
  }

  async keyRequestResponse(
    masterName: string,
    requestId: string,
    results: { [key: string]: string }
  ): Promise<void> {
    await this._sendMessage(
      'keyRequestResponse',
      {
        toManager: true,
        sendMode: 'direct',
        to: masterName,
      },
      {
        requestId,
        results,
      }
    );
  }

  async synchronizeRequest(
    options: MessageBodies['synchronize']
  ): Promise<void> {
    await this._sendMessage(
      'synchronize',
      {
        sendMode: 'broadcast',
        toManager: false,
      },
      options
    );
  }

  protected async _sendMessage<ActionName extends MessageKeys>(
    action: ActionName,
    info: MessageInfoOmitFrom,
    data: Message<ActionName>['body']
  ): Promise<void> {
    await this._onSendMessage({
      action,
      info: { ...info, from: this.id },
      body: data,
    } as MessagesUnion);
  }

  protected abstract _onSendMessage(data: MessagesUnion): Promise<void>;
}
