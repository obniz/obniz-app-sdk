"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const chai_1 = require("chai");
const sinon_1 = __importDefault(require("sinon"));
const index_1 = require("../index");
const install_1 = require("../install");
const tools_1 = require("./util/tools");
const DummyObniz_1 = require("./util/DummyObniz");
const Device_1 = require("./util/Device");
const LogWorker_1 = require("./util/LogWorker");
const MemoryAdaptor_1 = require("../adaptor/MemoryAdaptor");
const AppEvent_1 = require("./util/AppEvent");
mocha_1.describe('single', () => {
    mocha_1.beforeEach(() => {
        LogWorker_1.LogWorker.__reset();
        DummyObniz_1.DummyObniz.__reset();
        MemoryAdaptor_1.MemoryAdaptor.memoryAdaptorList = [];
    });
    mocha_1.it('not start worker', async () => {
        new index_1.App({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: index_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
        });
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(0);
    });
    mocha_1.it('sync', async () => {
        const app = new index_1.App({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: index_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
        });
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(0);
        const { getCurrentEventNoStub, getDiffListFromObnizCloudStub, getListFromObnizCloudStub, } = obnizApiStub();
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
        chai_1.expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
        app.start({ express: false });
        await tools_1.wait(1000);
        chai_1.expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(2);
        await tools_1.wait(10 * 1000);
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
        chai_1.expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
        await tools_1.wait(60 * 1000);
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(2);
        chai_1.expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
    }).timeout(80 * 1000);
    mocha_1.it('webhook', async () => {
        const app = new index_1.App({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: index_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
        });
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(0);
        const { getCurrentEventNoStub, getDiffListFromObnizCloudStub, getListFromObnizCloudStub, } = obnizApiStub();
        // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
        app.start({ express: false });
        await tools_1.wait(100);
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
        chai_1.expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(2);
        app.expressWebhook({}, {});
        chai_1.expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(1);
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
    });
    mocha_1.it('add', async () => {
        const app = new index_1.App({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: index_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
        });
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(0);
        const { getCurrentEventNoStub, getDiffListFromObnizCloudStub, getListFromObnizCloudStub, } = obnizApiStub();
        // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
        app.start({ express: false });
        await tools_1.wait(10);
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
        chai_1.expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(2);
        getDiffListFromObnizCloudStub.returns({
            appEvents: AppEvent_1.appEventAddSamples,
            maxId: 5,
        });
        app.expressWebhook({}, {});
        await tools_1.wait(10);
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
        chai_1.expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(1);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(3);
    });
    mocha_1.it('remove', async () => {
        const app = new index_1.App({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: index_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
        });
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(0);
        const { getCurrentEventNoStub, getDiffListFromObnizCloudStub, getListFromObnizCloudStub, } = obnizApiStub();
        // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
        app.start({ express: false });
        await tools_1.wait(10);
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
        chai_1.expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(2);
        getDiffListFromObnizCloudStub.returns({
            appEvents: AppEvent_1.appEventDeleteSamples,
            maxId: 5,
        });
        app.expressWebhook({}, {});
        await tools_1.wait(10);
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
        chai_1.expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(1);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(1);
    });
    mocha_1.it('remove and add', async () => {
        const app = new index_1.App({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: index_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
        });
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(0);
        const { getCurrentEventNoStub, getDiffListFromObnizCloudStub, getListFromObnizCloudStub, } = obnizApiStub();
        // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
        app.start({ express: false });
        await tools_1.wait(10);
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
        chai_1.expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(0);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(2);
        chai_1.expect(LogWorker_1.LogWorker.workers[0].obniz.id).to.be.equal(Device_1.deviceA.id);
        getDiffListFromObnizCloudStub.returns({
            appEvents: AppEvent_1.appEventDeleteAndUpdateSamples,
            maxId: 6,
        });
        app.expressWebhook({}, {});
        await tools_1.wait(10);
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
        chai_1.expect(getDiffListFromObnizCloudStub.callCount).to.be.equal(1);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(2);
        chai_1.expect(LogWorker_1.LogWorker.workers[0].obniz.id).to.be.equal(Device_1.deviceB.id);
    });
    mocha_1.it('access token', async () => {
        const cloudSdkToken = '989786r7tyghjnkooyfvasdfa';
        const app = new index_1.App({
            appToken: cloudSdkToken,
            workerClass: LogWorker_1.LogWorker,
            instanceType: index_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
        });
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(0);
        const { getCurrentEventNoStub, getDiffListFromObnizCloudStub, getListFromObnizCloudStub, } = obnizApiStub();
        // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
        app.start({ express: false });
        await tools_1.wait(10);
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(2);
        chai_1.expect(DummyObniz_1.DummyObniz.obnizes.length).to.be.equal(2);
        const obnizC = DummyObniz_1.DummyObniz.obnizes[0];
        chai_1.expect(obnizC.options.access_token).to.be.equal(cloudSdkToken);
        chai_1.expect(obnizC.options.auto_connect).to.be.equal(false);
    });
    mocha_1.it('different env', async () => {
        const cloudSdkToken = '989786r7tyghjnkooyfvasdfa';
        const app = new index_1.App({
            appToken: cloudSdkToken,
            workerClass: LogWorker_1.LogWorker,
            instanceType: index_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
            obnizOption: { obniz_server: 'ws://localhost:9999' },
            obnizCloudSdkOption: { baseUrl: 'http://localhost:8888' },
        });
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(0);
        const { getListFromObnizCloudStub } = obnizApiStub();
        // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(0);
        app.start({ express: false });
        await tools_1.wait(10);
        chai_1.expect(getListFromObnizCloudStub.callCount).to.be.equal(1);
        chai_1.expect(getListFromObnizCloudStub.args[0][0]).to.be.equal(cloudSdkToken);
        chai_1.expect(getListFromObnizCloudStub.args[0][1]).to.be.deep.equal({
            baseUrl: 'http://localhost:8888',
        });
        await tools_1.wait(10);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(2);
        chai_1.expect(DummyObniz_1.DummyObniz.obnizes.length).to.be.equal(2);
        const obnizA = DummyObniz_1.DummyObniz.obnizes[0];
        chai_1.expect(obnizA.options.access_token).to.be.equal(cloudSdkToken);
        chai_1.expect(obnizA.options.auto_connect).to.be.equal(false);
        chai_1.expect(obnizA.options.obniz_server).to.be.equal('ws://localhost:9999');
    });
});
function obnizApiStub() {
    const getListFromObnizCloudStub = sinon_1.default.stub();
    getListFromObnizCloudStub.returns([Device_1.deviceA, Device_1.deviceB]);
    install_1.sharedInstalledDeviceManager.getListFromObnizCloud = getListFromObnizCloudStub;
    const getDiffListFromObnizCloudStub = sinon_1.default.stub();
    getDiffListFromObnizCloudStub.returns({
        appEvents: AppEvent_1.appEvnetSamples,
        maxId: 4,
    });
    install_1.sharedInstalledDeviceManager.getDiffListFromObnizCloud = getDiffListFromObnizCloudStub;
    const getCurrentEventNoStub = sinon_1.default.stub();
    getCurrentEventNoStub.returns(0);
    install_1.sharedInstalledDeviceManager.getCurrentEventNo = getCurrentEventNoStub;
    return {
        getListFromObnizCloudStub,
        getDiffListFromObnizCloudStub,
        getCurrentEventNoStub,
    };
}
//# sourceMappingURL=single.js.map