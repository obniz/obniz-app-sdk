const { App, AppInstanceType, Worker, Obniz } = require('../../dist')

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
  instanceType: AppInstanceType.Master,
  scaleFactor: 1,
  database: "redis",
  databaseConfig: process.env.REDIS_URL|| "redis://localhost:6379"
})

app.start();
