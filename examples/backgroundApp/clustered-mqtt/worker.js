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
const app = new App({
  appToken: process.env.APPTOKEN,
  workerClass: MyWorker,
  instanceType: AppInstanceType.Slave,
  instanceName: process.env.dynoId || 'worker0',
  maxWorkerNumPerInstance: 100,
  database: "mqtt",
  databaseConfig: "127.0.0.1",
  obnizClass: Obniz
})

app.start();
