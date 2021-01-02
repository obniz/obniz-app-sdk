"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@slack/client");
const log4js_1 = __importDefault(require("log4js"));
const SlackToken = "xoxb-4284650420-827006983648-XWsE2R2vcq4br5zMDsxl8PLQ";
const web = new client_1.WebClient(SlackToken);
exports.logger = log4js_1.default.getLogger();
exports.logger.level = "debug";
// TODO: 消すかどうか考える
exports.logger.postSlack = async (msg) => {
    exports.logger.info(msg);
    if (process.env.NODE_ENV !== "production") {
        return;
    }
    try {
        await web.chat.postMessage({
            channel: "server_others",
            text: msg,
            username: `obniz-app-sdk`,
        });
    }
    catch (e) {
        console.error(e);
    }
};
//# sourceMappingURL=logger.js.map