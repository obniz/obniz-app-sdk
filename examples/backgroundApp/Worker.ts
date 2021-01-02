import {Worker, Obniz} from "../../src/index";

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

  async onObnizConnect(obniz: Obniz){
    console.log("on obniz connect");

  }

  async onObnizLoop(obniz: Obniz){
    console.log("on obniz loop");
  }

  async onObnizClose(obniz: Obniz){
    console.log("on obniz close");
  }

}
