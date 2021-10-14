import {
  Installed_Device,
  Installed_Device as InstalledDevice,
} from 'obniz-cloud-sdk/sdk';
import { logger } from '../logger';

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
  results: { [key: string]: string };
  requestId: string;
}

export type ToMasterMessage = ReportMessage | KeyRequestResponseMessage;
export type ToSlaveMessage =
  | ReportRequestMessage
  | SynchronizeRequestMessage
  | KeyRequestMessage;
export type MessageBetweenInstance = ToMasterMessage | ToSlaveMessage;

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
  public onKeyRequest?: (requestId: string, key: string) => Promise<void>;
  public onKeyRequestResponse?: (
    requestId: string,
    instanceName: string,
    results: { [key: string]: string }
  ) => Promise<void>;
  public onSynchronize?: (installs: InstalledDevice[]) => Promise<void>;
  public onReported?: (
    instanceName: string,
    installIds: string[]
  ) => Promise<void>;
  public onRequestRequested?: (
    key: string
  ) => Promise<{ [key: string]: string }>;

  constructor(id: string, isMaster: boolean) {
    this.id = id;
    this.isMaster = isMaster;
  }

  protected _onMasterMessage(message: ToMasterMessage): void {
    if (message.action === 'report') {
      if (this.onReported) {
        this.onReported(message.instanceName, message.installIds)
          .then(() => {})
          .catch((e) => {
            logger.error(e);
          });
      }
    } else if (message.action === 'keyRequestResponse') {
      if (this.onKeyRequestResponse) {
        this.onKeyRequestResponse(
          message.requestId,
          message.instanceName,
          message.results
        )
          .then(() => {})
          .catch((e) => {
            logger.error(e);
          });
      }
    }
  }

  protected _onSlaveMessage(message: ToSlaveMessage): void {
    if (message.action === 'synchronize') {
      if (this.onSynchronize) {
        this.onSynchronize(message.installs)
          .then(() => {})
          .catch((e) => {
            logger.error(e);
          });
      }
    } else if (message.action === 'reportRequest') {
      if (this.onReportRequest) {
        this.onReportRequest()
          .then(() => {})
          .catch((e) => {
            logger.error(e);
          });
      }
    } else if (message.action === 'keyRequest') {
      if (this.onKeyRequest) {
        this.onKeyRequest(message.requestId, message.key)
          .then(() => {})
          .catch((e) => {
            logger.error(e);
          });
      }
    }
  }

  protected _onReady(): void {
    this.isReady = true;
    logger.debug('ready id:' + this.id);
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

  onMessage(message: MessageBetweenInstance): void {
    if (
      message.toMaster === false &&
      (message.instanceName === this.id || message.instanceName === '*')
    ) {
      this._onSlaveMessage(message);
    } else if (message.toMaster === true && this.isMaster === true) {
      this._onMasterMessage(message);
    }
  }

  async reportRequest(): Promise<void> {
    await this._send({
      action: 'reportRequest',
      instanceName: '*',
      toMaster: false,
    });
  }

  async report(instanceName: string, installIds: string[]): Promise<void> {
    await this._send({
      action: 'report',
      instanceName,
      toMaster: true,
      installIds,
    });
  }

  async keyRequest(key: string, requestId: string): Promise<void> {
    await this._send({
      action: 'keyRequest',
      instanceName: '*',
      toMaster: false,
      key,
      requestId,
    });
  }

  async keyRequestResponse(
    requestId: string,
    instanceName: string,
    results: { [key: string]: string }
  ): Promise<void> {
    await this._send({
      action: 'keyRequestResponse',
      instanceName,
      toMaster: true,
      results,
      requestId,
    });
  }

  async synchronize(
    instanceName: string,
    installs: Installed_Device[]
  ): Promise<void> {
    await this._send({
      action: 'synchronize',
      instanceName,
      toMaster: false,
      installs,
    });
  }

  protected abstract _send(json: MessageBetweenInstance): Promise<void>;
}
