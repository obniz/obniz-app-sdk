const { App, AppInstanceType, Worker } = require('../../dist')
const Obniz = require("obniz"); //specific obnizjs version

class MyWorker extends Worker {

  /**
   * Worker lifecycle
   */

  async onStart(){

  }

  async onLoop(){
    console.log("loop");
  }

  async onEnd(){

  }

  /**
   * obniz lifecycle
   */

  async onObnizConnect(obniz){

  }

  async onObnizLoop(obniz){

    console.log("obniz loop");
  }

  async onObnizClose(obniz){

  }


}

const app = new App({
  appToken: 'apptoken_Tmj2JMXVXgLBYW6iDlBzQph7L6uwcBYqRmW2NvnKk_kQeiwvnRCnUJePUrsTRtXW',
  workerClass: MyWorker,
  obnizClass: Obniz,
  instanceType: AppInstanceType.Master
})

app.start();