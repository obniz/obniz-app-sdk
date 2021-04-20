"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const client_1 = require("@slack/client");
const log4js_1 = __importDefault(require("log4js"));
const SlackToken = 'xxxx'; // TODO: input slack token from app
const web = new client_1.WebClient(SlackToken);
exports.logger = log4js_1.default.getLogger();
exports.logger.level = 'debug';
// TODO: 消すかどうか考える
exports.logger.postSlack = async (msg) => {
    exports.logger.info(msg);
    if (process.env.NODE_ENV !== 'production') {
        return;
    }
    try {
        await web.chat.postMessage({
            channel: 'server_others',
            text: msg,
            username: `obniz-app-sdk`,
        });
    }
    catch (e) {
        console.error(e);
    }
};
//# sourceMappingURL=logger.js.map