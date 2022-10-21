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
    _onReady() {
        this.isReady = true;
        logger_1.logger.debug(`ready id: ${this.id} (type: ${this.constructor.name})`);
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
    async onMessage(mes) {
        if (mes.info.toMaster) {
            await this._onMasterMessage(mes);
        }
        else {
            await this._onSlaveMessage(mes);
        }
    }
    async _onSlaveMessage(mes) {
        if (mes.info.toMaster)
            return;
        if (mes.info.sendMode === 'direct' && mes.info.instanceName !== this.id)
            return;
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
                if (this.onReportRequest) {
                    await this.onReportRequest();
                }
            }
            else if (mes.action === 'keyRequest') {
                if (this.onKeyRequest) {
                    await this.onKeyRequest(mes.body.requestId, mes.body.key, mes.body.obnizId);
                }
            }
        }
        catch (e) {
            logger_1.logger.error(e);
        }
    }
    async _onMasterMessage(mes) {
        if (!mes.info.toMaster)
            return;
        try {
            if (mes.action === 'report') {
                if (this.onReported)
                    await this.onReported(mes.info.instanceName, mes.body.installIds);
            }
            else if (mes.action === 'keyRequestResponse') {
                const { requestId, results } = mes.body;
                if (this.onKeyRequestResponse)
                    await this.onKeyRequestResponse(requestId, mes.info.instanceName, results);
            }
        }
        catch (e) {
            logger_1.logger.error(e);
        }
    }
    async reportRequest() {
        await this._sendMessage({
            action: 'reportRequest',
            info: {
                sendMode: 'broadcast',
                toMaster: false,
            },
            body: {},
        });
    }
    async report(instanceName, installIds) {
        await this._sendMessage({
            action: 'report',
            info: {
                instanceName,
                sendMode: 'direct',
                toMaster: true,
            },
            body: {
                installIds,
            },
        });
    }
    async keyRequest(key, requestId) {
        await this._sendMessage({
            action: 'keyRequest',
            info: {
                toMaster: false,
                sendMode: 'broadcast',
            },
            body: {
                requestId,
                key,
            },
        });
    }
    async directKeyRequest(obnizId, instanceName, key, requestId) {
        await this._sendMessage({
            action: 'keyRequest',
            info: {
                toMaster: false,
                sendMode: 'direct',
                instanceName,
            },
            body: {
                obnizId,
                requestId,
                key,
            },
        });
    }
    async keyRequestResponse(requestId, instanceName, results) {
        await this._sendMessage({
            action: 'keyRequestResponse',
            info: {
                toMaster: true,
                instanceName,
                sendMode: 'direct',
            },
            body: {
                requestId,
                results,
            },
        });
    }
    async synchronizeRequest(options) {
        await this._sendMessage({
            action: 'synchronize',
            info: {
                sendMode: 'broadcast',
                toMaster: false,
            },
            body: options,
        });
    }
}
exports.Adaptor = Adaptor;
//# sourceMappingURL=Adaptor.js.map