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
        const getListFromObnizCloudStub = sinon_1.default.stub();
        getListFromObnizCloudStub.returns([Device_1.deviceA, Device_1.deviceB]);
        install_1.sharedInstalledDeviceManager.getListFromObnizCloud = getListFromObnizCloudStub;
        // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
        chai_1.expect(install_1.sharedInstalledDeviceManager.getListFromObnizCloud
            .callCount).to.be.equal(0);
        app.start({ express: false });
        chai_1.expect(install_1.sharedInstalledDeviceManager.getListFromObnizCloud
            .callCount).to.be.equal(1);
        await tools_1.wait(100);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(2);
        await tools_1.wait(10 * 1000);
        chai_1.expect(install_1.sharedInstalledDeviceManager.getListFromObnizCloud
            .callCount).to.be.equal(1);
        await tools_1.wait(60 * 1000);
        chai_1.expect(install_1.sharedInstalledDeviceManager.getListFromObnizCloud
            .callCount).to.be.equal(2);
    }).timeout(80 * 1000);
    mocha_1.it('webhook', async () => {
        const app = new index_1.App({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: index_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
        });
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(0);
        const getListFromObnizCloudStub = sinon_1.default.stub();
        getListFromObnizCloudStub.returns([Device_1.deviceA, Device_1.deviceB]);
        install_1.sharedInstalledDeviceManager.getListFromObnizCloud = getListFromObnizCloudStub;
        // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
        chai_1.expect(install_1.sharedInstalledDeviceManager.getListFromObnizCloud
            .callCount).to.be.equal(0);
        app.start({ express: false });
        chai_1.expect(install_1.sharedInstalledDeviceManager.getListFromObnizCloud
            .callCount).to.be.equal(1);
        await tools_1.wait(100);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(2);
        app.expressWebhook({}, {});
        chai_1.expect(install_1.sharedInstalledDeviceManager.getListFromObnizCloud
            .callCount).to.be.equal(2);
    });
    mocha_1.it('add', async () => {
        const app = new index_1.App({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: index_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
        });
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(0);
        const getListFromObnizCloudStub = sinon_1.default.stub();
        getListFromObnizCloudStub.returns([Device_1.deviceA]);
        install_1.sharedInstalledDeviceManager.getListFromObnizCloud = getListFromObnizCloudStub;
        // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
        chai_1.expect(install_1.sharedInstalledDeviceManager.getListFromObnizCloud
            .callCount).to.be.equal(0);
        app.start({ express: false });
        chai_1.expect(install_1.sharedInstalledDeviceManager.getListFromObnizCloud
            .callCount).to.be.equal(1);
        await tools_1.wait(10);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(1);
        getListFromObnizCloudStub.returns([Device_1.deviceA, Device_1.deviceB]);
        app.expressWebhook({}, {});
        await tools_1.wait(10);
        chai_1.expect(install_1.sharedInstalledDeviceManager.getListFromObnizCloud
            .callCount).to.be.equal(2);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(2);
    });
    mocha_1.it('remove', async () => {
        const app = new index_1.App({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: index_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
        });
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(0);
        const getListFromObnizCloudStub = sinon_1.default.stub();
        getListFromObnizCloudStub.returns([Device_1.deviceA, Device_1.deviceB]);
        install_1.sharedInstalledDeviceManager.getListFromObnizCloud = getListFromObnizCloudStub;
        // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
        chai_1.expect(install_1.sharedInstalledDeviceManager.getListFromObnizCloud
            .callCount).to.be.equal(0);
        app.start({ express: false });
        await tools_1.wait(10);
        chai_1.expect(install_1.sharedInstalledDeviceManager.getListFromObnizCloud
            .callCount).to.be.equal(1);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(2);
        getListFromObnizCloudStub.returns([Device_1.deviceA]);
        app.expressWebhook({}, {});
        await tools_1.wait(10);
        chai_1.expect(install_1.sharedInstalledDeviceManager.getListFromObnizCloud
            .callCount).to.be.equal(2);
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
        const getListFromObnizCloudStub = sinon_1.default.stub();
        getListFromObnizCloudStub.returns([Device_1.deviceA]);
        install_1.sharedInstalledDeviceManager.getListFromObnizCloud = getListFromObnizCloudStub;
        // const stubInstalledDeviceManager = stubObject<InstalledDeviceManager>(sharedInstalledDeviceManager,["getListFromObnizCloud"])
        chai_1.expect(install_1.sharedInstalledDeviceManager.getListFromObnizCloud
            .callCount).to.be.equal(0);
        app.start({ express: false });
        await tools_1.wait(10);
        chai_1.expect(install_1.sharedInstalledDeviceManager.getListFromObnizCloud
            .callCount).to.be.equal(1);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(1);
        chai_1.expect(LogWorker_1.LogWorker.workers[0].obniz.id).to.be.equal(Device_1.deviceA.id);
        getListFromObnizCloudStub.returns([Device_1.deviceB]);
        app.expressWebhook({}, {});
        await tools_1.wait(10);
        chai_1.expect(install_1.sharedInstalledDeviceManager.getListFromObnizCloud
            .callCount).to.be.equal(2);
        chai_1.expect(LogWorker_1.LogWorker.workers.length).to.be.equal(1);
        chai_1.expect(LogWorker_1.LogWorker.workers[0].obniz.id).to.be.equal(Device_1.deviceB.id);
    });
});
//# sourceMappingURL=single.js.map