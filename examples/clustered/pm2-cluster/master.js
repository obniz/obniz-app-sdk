const { App, AppInstanceType, Worker } = require('../../../dist')
const Obniz = require("obniz");

class MyWorker extends Worker {

  // Simple Example

  async onStart(){
    console.log(`onStart instance=${process.env.NODE_APP_INSTANCE}`);
  }

  async onObnizConnect(obniz){
    console.log(`connected to obniz ${obniz.id} ${obniz.metadata.description}`);
  }

  async onObnizLoop(obniz){
    console.log(`obniz loop ${obniz.id} ${obniz.metadata.description}`);
  }

}

const app = new App({
  appToken: process.env.APPTOKEN,
  workerClass: MyWorker,
  instanceType: AppInstanceType.Master,
  database: "redis",
  databaseConfig: process.env.REDIS_URL|| "redis://localhost:6379",
  obnizClass: Obniz
})

app.start();
