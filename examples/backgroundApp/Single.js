const { App, AppInstanceType, Worker } = require('../../dist')
const Obniz = require("obniz");

class MyWorker extends Worker {

  /**
   * Worker lifecycle
   */

  async onStart(){
    console.log("onStart");
  }

  async onLoop(){
    console.log("onLoop");
  }

  async onEnd(){
    console.log("onEnd");
  }

  async onRequest(key) {
    return `response from ${this.obniz.id}`
  }

  /**
   * obniz lifecycle
   */

   async onObnizConnect(obniz){
    console.log(`connected to obniz ${obniz.id} ${obniz.metadata.description}`);
  }

  async onObnizLoop(obniz){
    console.log(`obniz loop ${obniz.id} ${obniz.metadata.description}`);
  }

  async onObnizClose(obniz){
    console.log(`obniz disconnected from ${obniz.id} ${obniz.metadata.description}`);
  }


}

const app = new App({
  appToken: process.env.AppToken,
  workerClass: MyWorker,
  instanceType: AppInstanceType.Master,
  obnizClass: Obniz
})

app.start();

setTimeout(async ()=>{
  console.log(await app.request("something_key"))
}, 10 * 1000);
