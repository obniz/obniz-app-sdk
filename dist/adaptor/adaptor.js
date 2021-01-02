"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Adaptor = void 0;
/**
 * 一方向性のリスト同期
 * Masterからは各Instanceへ分割されたリストを同期
 * Slaveからはping情報の送信のみ
 * Cassandraと同じく「時間が経てば正しくなる」方式を採用。
 */
class Adaptor {
    constructor() {
    }
    async synchronize(instanceName, installs) {
        if (this.onSynchronize) {
            await this.onSynchronize(installs);
        }
    }
    async reportRequest() {
        if (this.onReportRequest) {
            await this.onReportRequest();
        }
    }
    async report(instanceName, installIds) {
        if (this.onReported) {
            this.onReported(instanceName, installIds);
        }
    }
}
exports.Adaptor = Adaptor;
//# sourceMappingURL=Adaptor.js.map