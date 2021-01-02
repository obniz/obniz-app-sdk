"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
__export(require("./App"));
__export(require("./Worker"));
/**
 * User Required to be import Obniz for argument.
 * So it must be exported from this library
 */
const obniz_1 = __importDefault(require("obniz"));
exports.Obniz = obniz_1.default;
//# sourceMappingURL=index.js.map