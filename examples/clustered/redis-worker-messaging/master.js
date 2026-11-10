const { App, AppInstanceType } = require('../../../dist');
const Obniz = require('obniz');
const { MessagingWorker } = require('./MessagingWorker');

const app = new App({
  appToken: process.env.APPTOKEN,
  workerClass: MessagingWorker,
  instanceType: AppInstanceType.Master,
  database: 'redis',
  databaseConfig: process.env.REDIS_URL || 'redis://localhost:6379',
  obnizClass: Obniz,
});

app.start();
