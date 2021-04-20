"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const log4js_1 = __importDefault(require("log4js"));
exports.logger = log4js_1.default.getLogger();
exports.logger.level = 'debug';
//# sourceMappingURL=logger.js.map