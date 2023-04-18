import { App } from './App';
import { logger } from './logger';
import { IObniz, IObnizOptions } from './Obniz.interface';
import { User } from 'obniz-cloud-sdk/sdk';
import { getSdk } from 'obniz-cloud-sdk';
import { DeviceInfo } from './types/device';

/**
 * This class is exported from this library
 * "Abstract" must be drop
 * Example: https://qiita.com/okdyy75/items/610623943979cf422775#%E3%81%BE%E3%81%82%E3%81%A8%E3%82%8A%E3%81%82%E3%81%88%E3%81%9A%E3%81%A9%E3%82%93%E3%81%AA%E6%84%9F%E3%81%98%E3%81%AB%E6%9B%B8%E3%81%8F%E3%81%AE
 */
export class Worker<O extends IObniz> {
  public deviceInfo: DeviceInfo;
  protected app: App<O>;
  protected obniz: O;
  public state: 'stopped' | 'starting' | 'started' | 'stopping' = 'stopped';
  protected readonly _obnizOption: IObnizOptions;
  public user?: User | null;
  private _cloudSdk: ReturnType<typeof getSdk> | null;

  constructor(deviceInfo: DeviceInfo, app: App<O>, option: IObnizOptions = {}) {
    this.deviceInfo = deviceInfo;
    this.app = app;
    this._obnizOption = option;
    const overrideOptions: IObnizOptions = {
      auto_connect: false,
    };
    this.obniz = new this.app.obnizClass(this.deviceInfo.id, {
      ...this._obnizOption,
      ...overrideOptions,
    });
    this.obniz.onconnect = this.onObnizConnect.bind(this);
    this.obniz.onloop = this.onObnizLoop.bind(this);
    this.obniz.onclose = this.onObnizClose.bind(this);

    this.user = this.deviceInfo.user;

    this._cloudSdk = this._obnizOption.access_token
      ? getSdk(this._obnizOption.access_token, app._options.obnizCloudSdkOption)
      : null;
  }

  /**
   * Worker lifecycle
   */

  /**
   * Called When newaly Installed
   * This will be called before onStart after instantiated.
   * Introduces from v1.4.0
   */
  async onInstall(): Promise<void> {}

  /**
   * Called When Uninstalled
   * This will be called before onEnd()
   * Introduces from v1.4.0
   */
  async onUnInstall(): Promise<void> {}

  /**
   * Worker lifecycle
   */

  async onStart(): Promise<void> {}

  /**
   * This funcion will be called rrepeatedly while App is started.
   */
  async onLoop(): Promise<void> {}

  async onEnd(): Promise<void> {}

  /**
   *
   * @param key string key that represents what types of reqeust.
   * @returns string for requested key
   */
  async onRequest(key: string): Promise<string> {
    return '';
  }

  /**
   * obniz lifecycle
   */

  async onObnizConnect(obniz: O): Promise<void> {}

  async onObnizLoop(obniz: O): Promise<void> {}

  async onObnizClose(obniz: O): Promise<void> {}

  /**
   * Start Application by recofnizing Install/Update
   * @param onInstall if start reason is new install then true;
   */
  async start(onInstall = false): Promise<void> {
    if (this.state !== 'stopped') {
      throw new Error(`invalid state`);
    }
    this.state = 'starting';
    if (onInstall) {
      await this.onInstall();
    }
    await this.onStart();

    this.state = 'started';

    this.obniz.autoConnect = true;
    this.obniz.connect();

    // in background
    // noinspection ES6MissingAwait
    this._loop();
  }

  private async _loop(): Promise<void> {
    while (this.state === 'starting' || this.state === 'started') {
      try {
        await this.onLoop();
      } catch (e) {
        logger.error(e);
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });
    }
  }

  async stop(): Promise<void> {
    if (this.state === 'starting' || this.state === 'started') {
      this.state = 'stopping';
      if (this.obniz) {
        try {
          await this.obniz.closeWait();
        } catch (e) {
          console.error(e); // handle close caused error. and promise onEnd() called
        }
      }
      await this.onEnd();
      this.state = 'stopped';
    }
  }

  protected async statusUpdateWait(status: 'success' | 'error', text: string) {
    if (!this._cloudSdk) {
      return;
    }

    await this._cloudSdk.createAppStatus({
      createAppStatusInput: {
        obniz: {
          id: this.obniz.id,
        },
        result: {
          status,
          text,
        },
      },
    });
  }

  protected addLogQueue(level: 'info' | 'error', message: string) {
    if (!this._cloudSdk) {
      return;
    }
    message = '' + message;

    this._cloudSdk
      .createAppLog({
        createAppLogInput: {
          obniz: {
            id: this.obniz.id,
          },
          app: {
            logJson: JSON.stringify({ message }),
            level,
          },
        },
      })
      .catch((e) => {
        console.warn(`failed to send log ${message}`);
      });
  }

  cloudLog = {
    info: (message: string) => {
      this.addLogQueue('info', message);
    },
    error: (message: string) => {
      this.addLogQueue('error', message);
    },
  };
}

export type WorkerStatic<O extends IObniz> = new (
  deviceInfo: DeviceInfo,
  app: App<O>,
  option: IObnizOptions
) => Worker<O>;
