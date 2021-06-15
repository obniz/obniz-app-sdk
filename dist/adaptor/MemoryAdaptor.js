"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryAdaptor = void 0;
const Adaptor_1 = require("./Adaptor");
const logger_1 = require("../logger");
class MemoryAdaptor extends Adaptor_1.Adaptor {
    constructor(id, isMaster, options) {
        super();
        this.isMaster = false;
        this.id = id;
        this.isMaster = isMaster;
        this.options = options;
        this.onReady().catch((e) => logger_1.logger.error(e));
    }
    async onReady() {
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
    async onMessage(message) {
        const parsed = JSON.parse(message);
        // slave functions
        if (this.isMaster === parsed.toMaster &&
            this.isMaster === false &&
            (parsed.instanceName === this.id || parsed.instanceName === '*')) {
            if (parsed.action === 'synchronize') {
                if (this.onSynchronize) {
                    this.onSynchronize(parsed.installs)
                        .then(() => { })
                        .catch((e) => {
                        logger_1.logger.error(e);
                    });
                }
            }
            else if (parsed.action === 'reportRequest') {
                if (this.onReportRequest) {
                    this.onReportRequest()
                        .then(() => { })
                        .catch((e) => {
                        logger_1.logger.error(e);
                    });
                }
            }
            // master functions
        }
        else if (this.isMaster === parsed.toMaster && this.isMaster === true) {
            if (parsed.action === 'report') {
                if (this.onReported) {
                    this.onReported(parsed.instanceName, parsed.installIds)
                        .then(() => { })
                        .catch((e) => {
                        logger_1.logger.error(e);
                    });
                }
            }
        }
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async send(json) {
        const data = JSON.stringify(json);
        await this.onMessage(data);
    }
    async synchronize(instanceName, installs) {
        await this.send({
            action: 'synchronize',
            instanceName,
            toMaster: false,
            installs,
        });
    }
    async reportRequest() {
        await this.send({
            action: 'reportRequest',
            instanceName: '*',
            toMaster: false,
        });
    }
    async report(instanceName, installIds) {
        await this.send({
            action: 'report',
            instanceName,
            toMaster: true,
            installIds,
        });
    }
}
exports.MemoryAdaptor = MemoryAdaptor;
//# sourceMappingURL=MemoryAdaptor.js.map