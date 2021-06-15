import { Installed_Device } from 'obniz-cloud-sdk/sdk';
import { Adaptor } from './Adaptor';
import { logger } from '../logger';

export interface MemoryAdaptorOptions {
  limit: number;
}

export class MemoryAdaptor extends Adaptor {
  public isMaster = false;

  public id: string;
  public readonly options: MemoryAdaptorOptions;

  constructor(id: string, isMaster: boolean, options: MemoryAdaptorOptions) {
    super();

    this.id = id;
    this.isMaster = isMaster;
    this.options = options;

    this.onReady().catch((e) => logger.error(e));
  }

  async onReady() {
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

  async onMessage(message: string) {
    const parsed = JSON.parse(message);
    // slave functions
    if (
      this.isMaster === parsed.toMaster &&
      this.isMaster === false &&
      (parsed.instanceName === this.id || parsed.instanceName === '*')
    ) {
      if (parsed.action === 'synchronize') {
        if (this.onSynchronize) {
          this.onSynchronize(parsed.installs)
            .then(() => {})
            .catch((e) => {
              logger.error(e);
            });
        }
      } else if (parsed.action === 'reportRequest') {
        if (this.onReportRequest) {
          this.onReportRequest()
            .then(() => {})
            .catch((e) => {
              logger.error(e);
            });
        }
      }
      // master functions
    } else if (this.isMaster === parsed.toMaster && this.isMaster === true) {
      if (parsed.action === 'report') {
        if (this.onReported) {
          this.onReported(parsed.instanceName, parsed.installIds)
            .then(() => {})
            .catch((e) => {
              logger.error(e);
            });
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async send(json: any): Promise<void> {
    const data = JSON.stringify(json);
    await this.onMessage(data);
  }

  async synchronize(
    instanceName: string,
    installs: Installed_Device[]
  ): Promise<void> {
    await this.send({
      action: 'synchronize',
      instanceName,
      toMaster: false,
      installs,
    });
  }

  async reportRequest(): Promise<void> {
    await this.send({
      action: 'reportRequest',
      instanceName: '*',
      toMaster: false,
    });
  }

  async report(instanceName: string, installIds: string[]): Promise<void> {
    await this.send({
      action: 'report',
      instanceName,
      toMaster: true,
      installIds,
    });
  }
}
