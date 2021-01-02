import Obniz from 'obniz'
import {App} from "./App";
import {ObnizOptions} from "obniz/dist/src/obniz/ObnizOptions";
import {logger} from "./logger";

/**
 * This class is exported from this library
 * "Abstract" must be drop
 * Example: https://qiita.com/okdyy75/items/610623943979cf422775#%E3%81%BE%E3%81%82%E3%81%A8%E3%82%8A%E3%81%82%E3%81%88%E3%81%9A%E3%81%A9%E3%82%93%E3%81%AA%E6%84%9F%E3%81%98%E3%81%AB%E6%9B%B8%E3%81%8F%E3%81%AE
 */
export abstract class Worker {
  public install: any;
  protected app: App;
  protected obniz?: Obniz;
  public state: "stopped" | "starting" | "started" | "stopping" = "stopped";
  private readonly _obnizOption: ObnizOptions;

  constructor(install: any, app: App, option: ObnizOptions = {}) {
    this.install = install;
    this.app = app;
    this._obnizOption = option;
  }


  /**
   * Worker lifecycle
   */

  async onStart() {

  }

  async onLoop() {

  }

  async onEnd() {

  }

  /**
   * obniz lifecycle
   */


  async onObnizConnect(obniz: Obniz) {

  }

  async onObnizLoop(obniz: Obniz) {

  }

  async onObnizClose(obniz: Obniz) {

  }


  async start() {
    if (this.state !== "stopped") {
      throw new Error(`invalid state`);
    }
    this.state = "starting";
    await this.onStart();
    this.obniz = new Obniz(this.install.id, this._obnizOption);
    this.obniz.onconnect = this.onObnizConnect.bind(this);
    this.obniz.onloop = this.onObnizLoop.bind(this);
    this.obniz.onclose = this.onObnizClose.bind(this);
    this.state = "started";

    // in background
    // noinspection ES6MissingAwait
    this._loop();

  }

  private async _loop() {
    while (this.state === "starting" || this.state === "started") {
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

  async stop() {
    if (this.state === "starting" || this.state === "started") {
      this.state = "stopping";
      if (this.obniz) {
        this.obniz.close(); //todo: change to closeWait
      }
      this.obniz = undefined;
      await this.onEnd();


      this.state = "stopped";
    }
  }
}
