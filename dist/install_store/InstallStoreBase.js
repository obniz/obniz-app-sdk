"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstallStoreBase = exports.InstallStatus = void 0;
var InstallStatus;
(function (InstallStatus) {
    InstallStatus[InstallStatus["Starting"] = 0] = "Starting";
    InstallStatus[InstallStatus["Started"] = 1] = "Started";
    InstallStatus[InstallStatus["Stopping"] = 2] = "Stopping";
    InstallStatus[InstallStatus["Stopped"] = 3] = "Stopped";
})(InstallStatus = exports.InstallStatus || (exports.InstallStatus = {}));
class InstallStoreBase {
}
exports.InstallStoreBase = InstallStoreBase;
//# sourceMappingURL=InstallStoreBase.js.map