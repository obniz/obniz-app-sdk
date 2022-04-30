const { App, AppInstanceType, Worker } = require('../../../dist')
const Obniz = require("obniz");

class MyWorker extends Worker {

  // Simple Example

  async onObnizConnect(obniz) {
    console.log(`connected to obniz ${obniz.id} ${obniz.metadata.description}`);
  }

  async onObnizLoop(obniz) {
    console.log(`obniz loop ${obniz.id} ${obniz.metadata.description}`);
  }

}

const main = async () => {
  const app = new App({
    appToken: process.env.APPTOKEN,
    workerClass: MyWorker,
    instanceType: AppInstanceType.Master,
    instanceName: 'master1',
    database: "redis",
    databaseConfig: process.env.REDIS_URL || "redis://localhost:6379",
    obnizClass: Obniz
  })
  await app.startWait({
    port: 3335
  });
  // app.isFirstManager() is available
  /*if (app.isFirstManager()) {
    console.log('doAllRelocate');
    await app.doAllRelocate();
  };*/
};

main();
