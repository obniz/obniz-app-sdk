import Obniz from 'obniz'
import {App} from "./App";


export abstract class WorkerAbstract {
  public install : any;
  private app: App;

  constructor(install: any, app:App) {
    this.install = install;
    this.app = app;
  }


  /**
   * Worker lifecycle
   */

  onStart(){

  }

  onLoop(){

  }

  onEnd(){

  }

  /**
   * obniz lifecycle
   */


  onObnizConnect(obniz: Obniz){

  }

  onObnizLoop(obniz: Obniz){

  }

  onObnizClose(obniz: Obniz){

  }


  async stop(){

  }
}
