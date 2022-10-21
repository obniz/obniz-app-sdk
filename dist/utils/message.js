"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidMessage = void 0;
const MessageKeysArray = [
    'report',
    'reportRequest',
    'synchronize',
    'keyRequest',
    'keyRequestResponse',
];
const isValidMessage = (mes) => {
    return mes.action !== undefined && MessageKeysArray.includes(mes.action);
};
exports.isValidMessage = isValidMessage;
//# sourceMappingURL=message.js.map