import {WorkerAbstract} from "../../src/index";
import Obniz from 'obniz';


export class Worker extends WorkerAbstract {

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
