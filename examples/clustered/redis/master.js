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

  async onRequest(key){
    return `I'm ${this.install.id}, received ${key}!`;
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

setTimeout(async () => {
  const data = await app.directRequest('4255-6262', 'I love 4255-6262❤');
  console.log(data);
}, 10 * 1000);

setTimeout(async () => {
  const data = await app.request('Hello');
  console.log(data);
}, 15 * 1000);