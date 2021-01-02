import {Worker, Obniz} from "../../src/index";

export class MyWorker extends Worker {

  onStart() {
    console.log("on start");
  }

  onEnd() {
    console.log("on end");
  }

  onLoop() {
    console.log("on loop");
  }

  onObnizConnect(obniz: Obniz){
    console.log("on obniz connect");

  }

  onObnizLoop(obniz: Obniz){
    console.log("on obniz loop");
  }

  onObnizClose(obniz: Obniz){
    console.log("on obniz close");
  }

  async stop(){
    //TODO;
  }
}
