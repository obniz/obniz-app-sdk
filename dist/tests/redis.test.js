"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const DummyObniz_1 = require("./util/DummyObniz");
const LogWorker_1 = require("./util/LogWorker");
const App_1 = require("../App");
const ioredis_mock_1 = __importDefault(require("ioredis-mock"));
const proxyquire_1 = __importDefault(require("proxyquire"));
const chai_1 = require("chai");
const common_1 = require("../utils/common");
const sinon_1 = __importDefault(require("sinon"));
const Device_1 = require("./util/Device");
const AppEvent_1 = require("./util/AppEvent");
(0, mocha_1.describe)('redis', () => {
    (0, mocha_1.beforeEach)(() => {
        LogWorker_1.LogWorker.__reset();
        DummyObniz_1.DummyObniz.__reset();
    });
    (0, mocha_1.it)('not start worker', async () => {
        const TestApp = getProxyedApp({});
        const app1 = new TestApp({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: App_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
            database: 'redis',
            instanceName: 'app1',
        });
        (0, chai_1.expect)(LogWorker_1.LogWorker.workers.length).to.be.equal(0);
    });
    (0, mocha_1.it)('one sync request to all slaves via redis', async () => {
        const { proxyStub, stubs: { getDiffListFromObnizCloudStub, getListFromObnizCloudStub }, } = createApiStub();
        const TestApp = getProxyedApp(proxyStub);
        const app1 = new TestApp({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: App_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
            database: 'redis',
            instanceName: 'app1',
        });
        const app2 = new TestApp({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: App_1.AppInstanceType.Slave,
            obnizClass: DummyObniz_1.DummyObniz,
            database: 'redis',
            instanceName: 'app2',
        });
        (0, chai_1.expect)(LogWorker_1.LogWorker.workers.length).to.be.equal(0);
        let appMessageCount = 0;
        const redisMock = new ioredis_mock_1.default();
        await redisMock.subscribe('app');
        redisMock.on('message', (c, m) => {
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
    }).timeout(20 * 1000);
    // it('broadcast key request', async () => {
    //   const app1 = new AppMock({
    //     appToken: process.env.AppToken || '',
    //     workerClass: LogWorker,
    //     instanceType: AppInstanceType.Master,
    //     obnizClass: DummyObniz,
    //     database: 'redis',
    //     instanceName: 'app1',
    //   });
    //   const {
    //     getCurrentEventNoStub,
    //     getDiffListFromObnizCloudStub,
    //     getListFromObnizCloudStub,
    //   } = obnizApiStub();
    //   expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
    //   expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    //   await app1.startWait({ express: false });
    //   await wait(1000);
    //   expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    //   expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    //   expect(LogWorker.workers.length).to.be.equal(2);
    //   const response = await app1.request('ping');
    //   expect(response).to.be.deep.equal({
    //     '7877-4454': 'response from 7877-4454',
    //     '0883-8329': 'response from 0883-8329',
    //   });
    // }).timeout(20 * 1000);
    // it('direct key request', async () => {
    //   const app1 = new AppMock({
    //     appToken: process.env.AppToken || '',
    //     workerClass: LogWorker,
    //     instanceType: AppInstanceType.Master,
    //     obnizClass: DummyObniz,
    //     database: 'redis',
    //     instanceName: 'app1',
    //   });
    //   const {
    //     getCurrentEventNoStub,
    //     getDiffListFromObnizCloudStub,
    //     getListFromObnizCloudStub,
    //   } = obnizApiStub();
    //   expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
    //   expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    //   await app1.startWait({ express: false });
    //   await wait(1000);
    //   expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    //   expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    //   expect(LogWorker.workers.length).to.be.equal(2);
    //   const response = await app1.directRequest('7877-4454', 'ping');
    //   expect(response).to.be.deep.equal({
    //     '7877-4454': 'response from 7877-4454',
    //   });
    // }).timeout(20 * 1000);
});
function createApiStub() {
    const getListFromObnizCloudStub = sinon_1.default.stub();
    getListFromObnizCloudStub.returns([Device_1.deviceA, Device_1.deviceB]);
    const getDiffListFromObnizCloudStub = sinon_1.default.stub();
    getDiffListFromObnizCloudStub.returns({
        appEvents: AppEvent_1.appEventSamples,
        maxId: 4,
    });
    const getCurrentEventNoStub = sinon_1.default.stub();
    getCurrentEventNoStub.returns(0);
    return {
        proxyStub: {
            './ObnizCloudClient': Object.assign({
                obnizCloudClientInstance: {
                    getListFromObnizCloud: getListFromObnizCloudStub,
                    getDiffListFromObnizCloud: getDiffListFromObnizCloudStub,
                    getCurrentEventNo: getCurrentEventNoStub,
                },
            }, { '@global': true }),
        },
        stubs: {
            getListFromObnizCloudStub,
            getDiffListFromObnizCloudStub,
            getCurrentEventNoStub,
        },
    };
}
function getProxyedApp(_anyStub) {
    const stub = Object.assign({ ioredis: Object.assign(ioredis_mock_1.default, { '@global': true }) }, _anyStub);
    return (0, proxyquire_1.default)('../App', stub).App;
}
//# sourceMappingURL=redis.test.js.map