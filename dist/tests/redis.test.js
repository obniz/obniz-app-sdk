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
(0, mocha_1.describe)('redis', () => {
    let AppMock;
    (0, mocha_1.beforeEach)(() => {
        LogWorker_1.LogWorker.__reset();
        DummyObniz_1.DummyObniz.__reset();
        const stub = {
            ioredis: Object.assign(ioredis_mock_1.default, { '@global': true }),
        };
        AppMock = (0, proxyquire_1.default)('../App', stub).App;
    });
    (0, mocha_1.it)('initialize', async () => {
        const app = new AppMock({
            appToken: process.env.AppToken || '',
            workerClass: LogWorker_1.LogWorker,
            instanceType: App_1.AppInstanceType.Master,
            obnizClass: DummyObniz_1.DummyObniz,
            database: 'redis',
        });
        await app.startWait({ express: false });
    });
});
//# sourceMappingURL=redis.test.js.map