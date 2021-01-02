"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
        this.onSynchronize(installs);
    }
    async reportRequest() {
        this.onReportRequest();
    }
    async report(instanceName, installIds) {
        this.onReported(instanceName, installIds);
    }
}
exports.default = Adaptor;
//# sourceMappingURL=adaptor.js.map