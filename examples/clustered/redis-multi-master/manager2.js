const { App, AppInstanceType, Worker } = require('../../../dist')
const Obniz = require("obniz");

/**
 * AppInstanceType.Manager never start workers inside of itself. It just manage workers.
 */
const app = new App({
  appToken: process.env.APPTOKEN,
  instanceType: AppInstanceType.Manager,
  instanceName: 'manager2',
  database: "redis",
  databaseConfig: process.env.REDIS_URL || "redis://localhost:6379",
  obnizClass: Obniz,
})

app.start({
  port: 3334
});
