const { App, AppInstanceType, Worker } = require('../../../dist')
const Obniz = require("obniz");

class MyWorker extends Worker {

  // Simple Example

  async onObnizConnect(obniz){
    console.log(`connected to obniz ${obniz.id} ${obniz.metadata.description}`);
  }

  async onObnizLoop(obniz){
    console.log(`obniz loop ${obniz.id} ${obniz.metadata.description}`);
  }

}

/**
 * AppInstanceType.Manager never start workers inside of itself. It just manage workers.
 */
const app = new App({
  appToken: process.env.APPTOKEN,
  workerClass: MyWorker,
  instanceType: AppInstanceType.Manager,
  database: "redis",
  databaseConfig: process.env.REDIS_URL|| "redis://localhost:6379",
  obnizClass: Obniz
})

app.start();