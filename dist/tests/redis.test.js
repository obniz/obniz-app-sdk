"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const DummyObniz_1 = require("./util/DummyObniz");
const LogWorker_1 = require("./util/LogWorker");
const App_1 = require("../App");
const ioredis_1 = __importDefault(require("ioredis"));
const chai_1 = require("chai");
const common_1 = require("../utils/common");
const sinon_1 = __importDefault(require("sinon"));
const Device_1 = require("./util/Device");
const AppEvent_1 = require("./util/AppEvent");
const redis_memory_server_1 = require("redis-memory-server");
const ObnizCloudClient_1 = require("../ObnizCloudClient");
let redisServer;
let redisAddress;
(0, mocha_1.beforeEach)(async () => {
    redisServer = new redis_memory_server_1.RedisMemoryServer();
    redisAddress = `redis://${await redisServer.getHost()}:${await redisServer.getPort()}`;
    console.log(redisAddress);
    LogWorker_1.LogWorker.__reset();
    DummyObniz_1.DummyObniz.__reset();
});
(0, mocha_1.afterEach)(async () => {
    if (redisServer)
        await redisServer.stop();
});
(0, mocha_1.describe)('redis', () => {
    (0, mocha_1.it)('not start worker', async () => {
        const app1 = new App_1.App({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: App_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
            database: 'redis',
            instanceName: 'app1',
            databaseConfig: redisAddress,
        });
        (0, chai_1.expect)(LogWorker_1.LogWorker.workers.length).to.be.equal(0);
    });
    (0, mocha_1.it)('one sync request to all slaves via redis', async () => {
        const app1 = new App_1.App({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: App_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
            database: 'redis',
            instanceName: 'app1',
            databaseConfig: redisAddress,
        });
        const app2 = new App_1.App({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: App_1.AppInstanceType.Slave,
            obnizClass: DummyObniz_1.DummyObniz,
            database: 'redis',
            instanceName: 'app2',
            databaseConfig: redisAddress,
        });
        (0, chai_1.expect)(LogWorker_1.LogWorker.workers.length).to.be.equal(0);
        const { getCurrentEventNoStub, getDiffListFromObnizCloudStub, getListFromObnizCloudStub, } = obnizApiStub();
        let appMessageCount = 0;
        const redisClient = new ioredis_1.default(redisAddress);
        await redisClient.subscribe('app');
        redisClient.on('message', (c, m) => {
            console.log({ c, m });
            appMessageCount++;
        });
        (0, chai_1.expect)(getListFromObnizCloudStub.callCount).to.be.equal(0);
        (0, chai_1.expect)(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
        await app1.startWait({ express: false });
        await app2.startWait({ express: false });
        await (0, common_1.wait)(5000);
        (0, chai_1.expect)(getListFromObnizCloudStub.callCount).to.be.equal(1);
        (0, chai_1.expect)(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
        (0, chai_1.expect)(appMessageCount).to.be.equal(2);
        redisClient.disconnect();
    }).timeout(20 * 1000);
    (0, mocha_1.it)('broadcast key request', async () => {
        const app1 = new App_1.App({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: App_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
            database: 'redis',
            instanceName: 'app1',
            databaseConfig: redisAddress,
        });
        const { getCurrentEventNoStub, getDiffListFromObnizCloudStub, getListFromObnizCloudStub, } = obnizApiStub();
        (0, chai_1.expect)(getListFromObnizCloudStub.callCount).to.be.equal(0);
        (0, chai_1.expect)(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
        await app1.startWait({ express: false });
        await (0, common_1.wait)(5000);
        (0, chai_1.expect)(getListFromObnizCloudStub.callCount).to.be.equal(1);
        (0, chai_1.expect)(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
        (0, chai_1.expect)(LogWorker_1.LogWorker.workers.length).to.be.equal(2);
        const response = await app1.request('ping');
        (0, chai_1.expect)(response).to.be.deep.equal({
            '7877-4454': 'response from 7877-4454',
            '0883-8329': 'response from 0883-8329',
        });
    }).timeout(20 * 1000);
    (0, mocha_1.it)('direct key request', async () => {
        const app1 = new App_1.App({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: App_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
            database: 'redis',
            instanceName: 'app1',
            databaseConfig: redisAddress,
        });
        const { getCurrentEventNoStub, getDiffListFromObnizCloudStub, getListFromObnizCloudStub, } = obnizApiStub();
        (0, chai_1.expect)(getListFromObnizCloudStub.callCount).to.be.equal(0);
        (0, chai_1.expect)(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
        await app1.startWait({ express: false });
        await (0, common_1.wait)(5000);
        (0, chai_1.expect)(getListFromObnizCloudStub.callCount).to.be.equal(1);
        (0, chai_1.expect)(getListFromObnizCloudStub.callCount).to.be.equal(1);
        (0, chai_1.expect)(LogWorker_1.LogWorker.workers.length).to.be.equal(2);
        const response = await app1.directRequest('7877-4454', 'ping');
        (0, chai_1.expect)(response).to.be.deep.equal({
            '7877-4454': 'response from 7877-4454',
        });
    }).timeout(20 * 1000);
});
function obnizApiStub() {
    const getListFromObnizCloudStub = sinon_1.default.stub();
    getListFromObnizCloudStub.returns([Device_1.deviceA, Device_1.deviceB]);
    ObnizCloudClient_1.obnizCloudClientInstance.getListFromObnizCloud = getListFromObnizCloudStub;
    const getDiffListFromObnizCloudStub = sinon_1.default.stub();
    getDiffListFromObnizCloudStub.returns({
        appEvents: AppEvent_1.appEventSamples,
        maxId: 4,
    });
    ObnizCloudClient_1.obnizCloudClientInstance.getDiffListFromObnizCloud =
        getDiffListFromObnizCloudStub;
    const getCurrentEventNoStub = sinon_1.default.stub();
    getCurrentEventNoStub.returns(0);
    ObnizCloudClient_1.obnizCloudClientInstance.getCurrentEventNo = getCurrentEventNoStub;
    return {
        getListFromObnizCloudStub,
        getDiffListFromObnizCloudStub,
        getCurrentEventNoStub,
    };
}
//# sourceMappingURL=redis.test.js.map