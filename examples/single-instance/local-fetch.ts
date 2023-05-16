import { Worker } from "../../src/index";
import Obniz from "obniz";
import { App, AppInstanceType } from "../../src/index";

export class MyWorker extends Worker<Obniz> {
  async onStart() {
    console.log("on start", this.obniz.id);
  }

  async onLoop() {
    console.log("on loop", this.obniz.id);
    this.cloudLog.info("app start");
  }

  async onEnd() {
    console.log("on end", this.obniz.id);
  }

  async onRequest(key: string): Promise<string> {
    return "";
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
  obnizClass: Obniz,
  fetcher: async () => {
    return [
      {
        id: "0000-0001",
        hardware: "blewifi_gw2",
        configs: "{}",
      },
      {
        id: "0000-0002",
        hardware: "blewifi_gw2",
        configs: "{}",
      },
      {
        id: "192.168.0.100",
        hardware: "blewifi_gw2",
        configs: "{}",
      },
    ];
  },
});

app.start();

// await app.request("something_key")
