"use strict";
/* eslint max-classes-per-file: 0 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObnizAppMasterSlaveCommunicationError = exports.ObnizAppTimeoutError = exports.ObnizAppError = void 0;
class ObnizAppError extends Error {
}
exports.ObnizAppError = ObnizAppError;
class ObnizAppTimeoutError extends ObnizAppError {
}
exports.ObnizAppTimeoutError = ObnizAppTimeoutError;
class ObnizAppMasterSlaveCommunicationError extends ObnizAppError {
}
exports.ObnizAppMasterSlaveCommunicationError = ObnizAppMasterSlaveCommunicationError;
//# sourceMappingURL=Errors.js.map