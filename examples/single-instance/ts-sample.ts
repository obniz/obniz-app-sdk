import {Worker} from "../../src/index";
import Obniz from 'obniz';
import {App, AppInstanceType} from '../../src/index'

export class MyWorker extends Worker<Obniz> {

  async onStart() {
    console.log("on start", this.install.id);
  }

  async onLoop() {
    console.log("on loop", this.install.id);
  }

  async onEnd() {
    console.log("on end", this.install.id);
  }

  async onRequest(key:string): Promise<string> {
    return ""
  }

  async onObnizConnect(obniz: Obniz) {
    console.log("on obniz connect");
  }

  async onObnizLoop(obniz: Obniz) {
    console.log("on obniz loop");
  }

  async onObnizClose(obniz: Obniz) {
    console.log("on obniz close");
  }

}

const app = new App({
  appToken: process.env.APPTOKEN as string,
  workerClass: MyWorker,
  instanceType: AppInstanceType.Master,
  obnizClass: Obniz
});

app.start();

// await app.request("something_key")
