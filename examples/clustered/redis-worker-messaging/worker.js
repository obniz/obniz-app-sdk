const { App, AppInstanceType } = require('../../../dist');
const Obniz = require('obniz');
const { MessagingWorker } = require('./MessagingWorker');

const app = new App({
  appToken: process.env.APPTOKEN,
  workerClass: MessagingWorker,
  instanceType: AppInstanceType.Slave,
  // hostname is the default. Set instanceName explicitly so this process can
  // coexist with master.js (which also runs a Slave internally) on the same
  // machine without colliding on the instance id.
  instanceName: process.env.INSTANCE_NAME || 'worker0',
  database: 'redis',
  databaseConfig: process.env.REDIS_URL || 'redis://localhost:6379',
  obnizClass: Obniz,
});

app.start();
