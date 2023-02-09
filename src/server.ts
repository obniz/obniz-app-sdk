import { logger } from "./logger";
import { WSS } from "./wss";
import { createServer } from "http";

export class Server {

  protected wss: WSS;
  protected server: any;

  public onObnizConnected: ((obniz_id: number) => void) | null = null;
  public onObnizDisConnected: ((obniz_id: number) => void) | null = null;
  public onObnizReplaced: ((obniz_id: number) => void) | null = null;

  constructor() {
    const wss = new WSS();
    this.wss = wss;

    wss.onObnizConnected = (room, date) => {
      const obniz_id = room.id;
      logger.info(
        `obniz ${obniz_id} connected.`
      );
      if (typeof this.onObnizConnected === 'function') {
        this.onObnizConnected(obniz_id);
      }
    }

    wss.onObnizDisConnected = (room, date) => {
      const obniz_id = room.id;
      logger.info(
        `obniz ${obniz_id} disconnected.`
      );
      if (typeof this.onObnizDisConnected === 'function') {
        this.onObnizDisConnected(obniz_id);
      }
    }

    wss.onObnizReplaced = (room, date) => {
      const obniz_id = room.id;
      logger.info(
        `obniz ${obniz_id} replaced.`
      );
      if (typeof this.onObnizReplaced === 'function') {
        this.onObnizReplaced(obniz_id);
      }
    }

    wss.onFileWriteRequest = (obniz, filename, buffer, mode) => {
      logger.debug(`obniz ${obniz.id} will send a file ${filename}`)
    }

    wss.dispatchMsgToOuterWorld = (dest, message) => {
    }

    wss.log = (room, json) => {
    }

    wss.info = (room, json) => {
    }

    wss.otaProgress = (room, progress) => {
    }
  }

  public start(port: number = 3003) {
    if (this.server) {
      logger.error(`Server is already started.`);
      return;
    }
    this.server = createServer((req, res) => {
      logger.debug(`req.url: ${req.url}`);
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify({}));
    });
    this.server.listen(port, () => {
      logger.info(
        `Websocket server start listening on ${port}`
      );
    });

    this.wss.start({
      server: this.server,
      wsroom_id: 1
    });
  }
}