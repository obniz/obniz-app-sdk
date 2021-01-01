"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Adaptor {
    constructor() {
    }
    async start(install, instanceName) {
        await this.onStart(install);
    }
    async update(install, instanceName) {
        await this.onUpdate(install);
    }
    async stop(install, instanceName) {
        await this.onStop(install);
    }
}
exports.default = Adaptor;
//# sourceMappingURL=adaptor.js.map