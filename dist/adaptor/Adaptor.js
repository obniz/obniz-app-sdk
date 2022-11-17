"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Adaptor = void 0;
const App_1 = require("../App");
const logger_1 = require("../logger");
/**
 * 一方向性のリスト同期
 * Masterからは各Instanceへ分割されたリストを同期
 * Slaveからはping情報の送信のみ
 * Cassandraと同じく「時間が経てば正しくなる」方式を採用。
 */
class Adaptor {
    constructor(id, instanceType) {
        this.isReady = false;
        this.id = id;
        this.instanceType = instanceType;
    }
    _onReady() {
        this.isReady = true;
        logger_1.logger.debug(`ready id: ${this.id} (type: ${this.constructor.name})`);
        if (this.instanceType === App_1.AppInstanceType.Master ||
            this.instanceType === App_1.AppInstanceType.Manager) {
            this.reportRequest()
                .then(() => { })
                .catch((e) => {
                logger_1.logger.error(e);
            });
        }
        else {
            if (this.onReportRequest) {
                this.onReportRequest('unknown')
                    .then(() => { })
                    .catch((e) => {
                    logger_1.logger.error(e);
                });
            }
        }
    }
    async onMessage(mes) {
        if (mes.info.toManager) {
            if (this.instanceType === App_1.AppInstanceType.Master ||
                this.instanceType === App_1.AppInstanceType.Manager)
                await this._onManagerMessage(mes);
        }
        else {
            if (this.instanceType === App_1.AppInstanceType.Master ||
                this.instanceType === App_1.AppInstanceType.Slave)
                await this._onSlaveMessage(mes);
        }
    }
    async _onSlaveMessage(mes) {
        if (mes.info.toManager)
            return;
        if (mes.info.sendMode === 'direct' && mes.info.to !== this.id)
            return;
        console.log('SlaveMessageReceived', { mes });
        try {
            if (mes.action === 'synchronize') {
                if (this.onSynchronize) {
                    if (mes.body.syncType === 'redis') {
                        await this.onSynchronize({
                            syncType: mes.body.syncType,
                        });
                    }
                    else {
                        await this.onSynchronize({
                            syncType: mes.body.syncType,
                            installs: mes.body.installs,
                        });
                    }
                }
            }
            else if (mes.action === 'reportRequest') {
                if (this.onReportRequest && mes.info.sendMode === 'direct') {
                    await this.onReportRequest(mes.info.to);
                }
            }
            else if (mes.action === 'keyRequest') {
                if (this.onKeyRequest) {
                    await this.onKeyRequest(mes.info.from, mes.body.requestId, mes.body.key, mes.body.obnizId);
                }
            }
        }
        catch (e) {
            logger_1.logger.error(e);
        }
    }
    async _onManagerMessage(mes) {
        if (!mes.info.toManager)
            return;
        if (mes.info.sendMode === 'direct' && // mes is direct message
            mes.info.to !== undefined && // "to" is set
            mes.info.to !== this.id // "to" is not me
        )
            return;
        console.log('ManagerMessageReceived', { mes });
        try {
            if (mes.action === 'report') {
                if (this.onReported)
                    await this.onReported(mes.info.from, mes.body.installIds);
            }
            else if (mes.action === 'keyRequestResponse') {
                const { requestId, results } = mes.body;
                if (this.onKeyRequestResponse)
                    await this.onKeyRequestResponse(requestId, mes.info.from, results);
            }
        }
        catch (e) {
            logger_1.logger.error(e);
        }
    }
    async reportRequest() {
        await this._sendMessage('reportRequest', {
            sendMode: 'broadcast',
            toManager: false,
        }, {});
    }
    async report(installIds, masterName) {
        const info = (masterName !== undefined
            ? {
                sendMode: 'direct',
                toManager: true,
                to: masterName,
            }
            : {
                sendMode: 'broadcast',
                toManager: true,
            });
        await this._sendMessage('report', info, {
            installIds,
        });
    }
    async keyRequest(key, requestId) {
        await this._sendMessage('keyRequest', {
            toManager: false,
            sendMode: 'broadcast',
        }, {
            requestId,
            key,
        });
    }
    async directKeyRequest(obnizId, instanceName, key, requestId) {
        await this._sendMessage('keyRequest', {
            toManager: false,
            sendMode: 'direct',
            to: instanceName,
        }, {
            obnizId,
            requestId,
            key,
        });
    }
    async keyRequestResponse(masterName, requestId, results) {
        await this._sendMessage('keyRequestResponse', {
            toManager: true,
            sendMode: 'direct',
            to: masterName,
        }, {
            requestId,
            results,
        });
    }
    async synchronizeRequest(options) {
        await this._sendMessage('synchronize', {
            sendMode: 'broadcast',
            toManager: false,
        }, options);
    }
    async _sendMessage(action, info, data) {
        await this._onSendMessage({
            action,
            info: Object.assign(Object.assign({}, info), { from: this.id }),
            body: data,
        });
    }
}
exports.Adaptor = Adaptor;
//# sourceMappingURL=Adaptor.js.map