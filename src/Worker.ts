import { App } from './App';
import { ObnizOptions } from 'obniz/dist/src/obniz/ObnizOptions';
import { logger } from './logger';
import { IObniz } from './Obniz.interface';
import { Installed_Device, User } from 'obniz-cloud-sdk/sdk';

/**
 * This class is exported from this library
 * "Abstract" must be drop
 * Example: https://qiita.com/okdyy75/items/610623943979cf422775#%E3%81%BE%E3%81%82%E3%81%A8%E3%82%8A%E3%81%82%E3%81%88%E3%81%9A%E3%81%A9%E3%82%93%E3%81%AA%E6%84%9F%E3%81%98%E3%81%AB%E6%9B%B8%E3%81%8F%E3%81%AE
 */
export class Worker<O extends IObniz> {
  public install: Installed_Device;
  protected app: App<O>;
  protected obniz: O;
  public state: 'stopped' | 'starting' | 'started' | 'stopping' = 'stopped';
  private readonly _obnizOption: ObnizOptions;
  public user: User;

  constructor(
    install: Installed_Device,
    app: App<O>,
    option: ObnizOptions = {}
  ) {
    this.install = install;
    this.app = app;
    this._obnizOption = option;

    const overrideOptions = {
      auto_connect: false,
    };
    this.obniz = new this.app.obnizClass(this.install.id, {
      ...this._obnizOption,
      ...overrideOptions,
    });
    this.obniz.onconnect = this.onObnizConnect.bind(this);
    this.obniz.onloop = this.onObnizLoop.bind(this);
    this.obniz.onclose = this.onObnizClose.bind(this);
    this.user = this.install.user!;
  }

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

  async start(): Promise<void> {
    if (this.state !== 'stopped') {
      throw new Error(`invalid state`);
    }
    this.state = 'starting';
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
}

export type WorkerStatic<O extends IObniz> = new (
  install: Installed_Device,
  app: App<O>
) => Worker<O>;
