import { WebClient } from "@slack/client";
import log4js from "log4js";

const SlackToken = "xoxb-4284650420-827006983648-XWsE2R2vcq4br5zMDsxl8PLQ";
const web = new WebClient(SlackToken);
export const logger: any = log4js.getLogger();
logger.level = "debug";

// TODO: 消すかどうか考える
logger.postSlack = async (msg: string) => {
  logger.info(msg);
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  try {
    await web.chat.postMessage({
      channel: "server_others",
      text: msg,
      username: `obniz-app-sdk`,
    });
  } catch (e) {
    console.error(e);
  }
};
