const { App, AppInstanceType, Worker, Obniz } = require('../../dist')

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

  }

  async onObnizLoop(obniz){

    console.log("obniz loop");
  }

  async onObnizClose(obniz){

  }


}

const app = new App({
  appToken: process.env.AppToken,
  workerClass: MyWorker,
  instanceType: AppInstanceType.Master
})

app.start();

setTimeout(async ()=>{
  console.log(await app.request("something_key"))
}, 10 * 1000);