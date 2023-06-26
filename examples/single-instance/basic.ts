import { Worker } from "../../src/index";
import Obniz from "obniz";
import { App, AppInstanceType } from "../../src/index";

export class MyWorker extends Worker<Obniz> {
  /**
   * Worker lifecycle
   */

  async onStart() {
    console.log("onStart", this.obniz.id);
    this.cloudLog.info("app start");
  }

  async onLoop() {
    console.log("onLoop", this.obniz.id);
  }

  async onEnd() {
    console.log("onEnd", this.obniz.id);
  }

  async onRequest(key: string): Promise<string> {
    return `response from ${this.obniz.id}`;
  }

  /**
   * obniz lifecycle
   */

  async onObnizConnect(obniz: Obniz) {
    console.log(`connected to obniz ${obniz.id} ${obniz.metadata?.description || 'no description'}`);
  }

  async onObnizLoop(obniz: Obniz) {
    console.log(`obniz loop ${obniz.id} ${obniz.metadata?.description || 'no description'}`);
  }

  async onObnizClose(obniz: Obniz) {
    console.log(`disconnected ${obniz.id} ${obniz.metadata?.description || 'no description'}`);
  }
}

const app = new App({
  appToken: process.env.APPTOKEN as string,
  workerClass: MyWorker,
  instanceType: AppInstanceType.Master,
  obnizClass: Obniz,
});

app.start();

setTimeout(async () => {
  console.log(await app.request("something_key"))
}, 10 * 1000);