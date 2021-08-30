"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Adaptor = void 0;
const logger_1 = require("../logger");
/**
 * 一方向性のリスト同期
 * Masterからは各Instanceへ分割されたリストを同期
 * Slaveからはping情報の送信のみ
 * Cassandraと同じく「時間が経てば正しくなる」方式を採用。
 */
class Adaptor {
    constructor(id, isMaster) {
        this.isMaster = false;
        this.isReady = false;
        this.id = id;
        this.isMaster = isMaster;
    }
    async request(key) {
        if (this.onRequestRequested) {
            return await this.onRequestRequested(key);
        }
        return {};
    }
    _onMasterMessage(message) {
        if (message.action === 'report') {
            if (this.onReported) {
                this.onReported(message.instanceName, message.installIds)
                    .then(() => { })
                    .catch((e) => {
                    logger_1.logger.error(e);
                });
            }
        }
    }
    _onSlaveMessage(message) {
        if (message.action === 'synchronize') {
            if (this.onSynchronize) {
                this.onSynchronize(message.installs)
                    .then(() => { })
                    .catch((e) => {
                    logger_1.logger.error(e);
                });
            }
        }
        else if (message.action === 'reportRequest') {
            if (this.onReportRequest) {
                this.onReportRequest()
                    .then(() => { })
                    .catch((e) => {
                    logger_1.logger.error(e);
                });
            }
        }
    }
    _onReady() {
        this.isReady = true;
        logger_1.logger.debug('ready id:' + this.id);
        if (this.isMaster) {
            this.reportRequest()
                .then(() => { })
                .catch((e) => {
                logger_1.logger.error(e);
            });
        }
        else {
            if (this.onReportRequest) {
                this.onReportRequest()
                    .then(() => { })
                    .catch((e) => {
                    logger_1.logger.error(e);
                });
            }
        }
    }
    onMessage(message) {
        if (message.toMaster === false &&
            (message.instanceName === this.id || message.instanceName === '*')) {
            this._onSlaveMessage(message);
        }
        else if (message.toMaster === true && this.isMaster === true) {
            this._onMasterMessage(message);
        }
    }
    async reportRequest() {
        await this._send({
            action: 'reportRequest',
            instanceName: '*',
            toMaster: false,
        });
    }
    async report(instanceName, installIds) {
        await this._send({
            action: 'report',
            instanceName,
            toMaster: true,
            installIds,
        });
    }
    async synchronize(instanceName, installs) {
        await this._send({
            action: 'synchronize',
            instanceName,
            toMaster: false,
            installs,
        });
    }
}
exports.Adaptor = Adaptor;
//# sourceMappingURL=Adaptor.js.map