"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const index_1 = require("obniz-cloud-sdk/index");
function authMiddleware(option = {}) {
    const _option = {
        tokenType: option.tokenType || "cookie",
        tokenKeyName: option.tokenKeyName || "token",
        addUserObjectToRequest: option.addUserObjectToRequest !== false
    };
    return async function (req, res, next) {
        let token = req.cookies[_option.tokenKeyName];
        const obnizAPI = index_1.getSdk(token);
        const ret = await obnizAPI.user();
        if (!ret || !ret.user) {
            next(new Error("user not found"));
            return;
        }
        if (_option.addUserObjectToRequest) {
            req.user = ret.user;
        }
    };
}
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=AuthMiddleware.js.map