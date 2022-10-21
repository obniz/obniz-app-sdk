import { logger } from '../logger';
import { MessageBodies, MessagesUnion } from '../utils/message';

/**
 * 一方向性のリスト同期
 * Masterからは各Instanceへ分割されたリストを同期
 * Slaveからはping情報の送信のみ
 * Cassandraと同じく「時間が経てば正しくなる」方式を採用。
 */
export abstract class Adaptor {
  public isMaster = false;
  public id: string;

  public isReady = false;

  public onReportRequest?: () => Promise<void>;
  public onKeyRequest?: (
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

  constructor(id: string, isMaster: boolean) {
    this.id = id;
    this.isMaster = isMaster;
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
        this.onReportRequest()
          .then(() => {})
          .catch((e) => {
            logger.error(e);
          });
      }
    }
  }

  async onMessage(mes: MessagesUnion): Promise<void> {
    if (mes.info.toMaster) {
      await this._onMasterMessage(mes);
    } else {
      await this._onSlaveMessage(mes);
    }
  }

  protected async _onSlaveMessage(mes: MessagesUnion): Promise<void> {
    if (mes.info.toMaster) return;
    if (mes.info.sendMode === 'direct' && mes.info.instanceName !== this.id)
      return;
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
        if (this.onReportRequest) {
          await this.onReportRequest();
        }
      } else if (mes.action === 'keyRequest') {
        if (this.onKeyRequest) {
          await this.onKeyRequest(
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

  protected async _onMasterMessage(mes: MessagesUnion): Promise<void> {
    if (!mes.info.toMaster) return;
    try {
      if (mes.action === 'report') {
        if (this.onReported)
          await this.onReported(mes.info.instanceName, mes.body.installIds);
      } else if (mes.action === 'keyRequestResponse') {
        const { requestId, results } = mes.body;
        if (this.onKeyRequestResponse)
          await this.onKeyRequestResponse(
            requestId,
            mes.info.instanceName,
            results
          );
      }
    } catch (e) {
      logger.error(e);
    }
  }

  async reportRequest(): Promise<void> {
    await this._sendMessage({
      action: 'reportRequest',
      info: {
        sendMode: 'broadcast',
        toMaster: false,
      },
      body: {},
    });
  }

  async report(instanceName: string, installIds: string[]): Promise<void> {
    await this._sendMessage({
      action: 'report',
      info: {
        instanceName,
        sendMode: 'direct',
        toMaster: true,
      },
      body: {
        installIds,
      },
    });
  }

  async keyRequest(key: string, requestId: string): Promise<void> {
    await this._sendMessage({
      action: 'keyRequest',
      info: {
        toMaster: false,
        sendMode: 'broadcast',
      },
      body: {
        requestId,
        key,
      },
    });
  }

  async directKeyRequest(
    obnizId: string,
    instanceName: string,
    key: string,
    requestId: string
  ): Promise<void> {
    await this._sendMessage({
      action: 'keyRequest',
      info: {
        toMaster: false,
        sendMode: 'direct',
        instanceName,
      },
      body: {
        obnizId,
        requestId,
        key,
      },
    });
  }

  async keyRequestResponse(
    requestId: string,
    instanceName: string,
    results: { [key: string]: string }
  ): Promise<void> {
    await this._sendMessage({
      action: 'keyRequestResponse',
      info: {
        toMaster: true,
        instanceName,
        sendMode: 'direct',
      },
      body: {
        requestId,
        results,
      },
    });
  }

  async synchronizeRequest(
    options: MessageBodies['synchronize']
  ): Promise<void> {
    await this._sendMessage({
      action: 'synchronize',
      info: {
        sendMode: 'broadcast',
        toMaster: false,
      },
      body: options,
    });
  }

  protected abstract _sendMessage(data: MessagesUnion): Promise<void>;
}
