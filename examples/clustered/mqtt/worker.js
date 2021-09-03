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
  instanceName: 'worker0', // hostname is default value. if you want to run same machine where master running, define instanceName as this example.
  database: "mqtt",
  databaseConfig: "mqtt://127.0.0.1", // address of master machine
  obnizClass: Obniz
})

app.start();
