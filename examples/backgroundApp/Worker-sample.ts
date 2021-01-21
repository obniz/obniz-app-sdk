import {Worker, Obniz} from "../../src/index";
import {App, AppInstanceType} from '../../src/index'

export class MyWorker extends Worker {

  async onStart() {
    console.log("on start", this.install.id);
  }

  async onEnd() {
    console.log("on end", this.install.id);
  }

  async onLoop() {
    console.log("on loop", this.install.id);
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
  appToken: "apptoken_daef3nDzxvShd8ArRkuzV82kqOm5RsxlnAShGahE3oxvZC8StwC6UOcvhB7wwNFL",
  workerClass: MyWorker,
  instanceType: AppInstanceType.Master,
  scaleFactor: 1,
  database: "redis",
  databaseConfig: process.env.REDIS_URL|| "redis://localhost:6379"

});

app.start();
