import { Server as WSServer } from 'ws';

import {
  parseObnizId,
  isClientWsRequest,
  isObnizWsRequest,
  verifyClient,
} from './wss_helper';
import Room from './room';
import * as ReqHeader from './room/obniz_req_header';
import { logger } from './logger';
import * as viewutil from './utils/obniz';
import { getObnizInfo } from './obnizcloud/api';

import Cron from 'node-cron';

export class WSS {
  private wsServer: WSServer | null = null;
  private wsroom_id: string | null = null;
  private _notAuthorizedRooms: Room[] = [];
  private _authorizedRooms: { [key: string]: Room } = {};

  // delegates
  public onObnizRequest: (room: Room, date: Date) => void;
  public onObnizConnected: (room: Room, date: Date) => void;
  public onObnizDisConnected: (room: Room, date: Date) => void;
  public onObnizReplaced: (room: Room, date: Date) => void;
  public onFileWriteRequest: (
    obniz: any,
    filename: string,
    buffer: Buffer,
    modee: string
  ) => void;
  public dispatchMsgToOuterWorld: (dest: number, payload: any) => void;
  public log: (room: Room, json: any) => void;
  public info: (room: Room, json: any) => void;
  public otaProgress: (room: Room, progress: any) => void;

  constructor() {

    // delegates
    this.onObnizRequest = (room, date) => { };
    this.onObnizConnected = (room, date) => { };
    this.onObnizDisConnected = (room, date) => { };
    this.onObnizReplaced = (room, date) => { };
    this.onFileWriteRequest = () => { };
    this.dispatchMsgToOuterWorld = () => { };
    this.log = () => { };
    this.info = () => { };
    this.otaProgress = () => { };

    Cron.schedule('*/10 * * * * *', () => {
      // every 10 seconds
      // この関数が完了する前にまた呼ばれる可能性はある。
      for (const obniz_id in this._authorizedRooms) {
        try {
          this._authorizedRooms[obniz_id].healthCheck();
        } catch (e) {
          logger.error(e);
        }
      }
    });

    Cron.schedule('0 * * * * *', () => {
      // every 60 seconds
      // この関数が完了する前にまた呼ばれる可能性はある。
      for (const obniz_id in this._authorizedRooms) {
        try {
          this._authorizedRooms[obniz_id].validateLicense();
          if (this._authorizedRooms[obniz_id]) {
            // maybe not exist hen license expired
            this._authorizedRooms[obniz_id].updateNetworkInfo();
          }
        } catch (e) {
          logger.error(e);
        }
      }
      const now = Date.now();
      for (let i = this._notAuthorizedRooms.length - 1; i >= 0; i--) {
        const notauthorized = this._notAuthorizedRooms[i];
        // 1分以上未承認であればroomは削除する
        const timeout = 2 * 60 * 1000;
        if (notauthorized.created_at + timeout < now) {
          this._notAuthorizedRooms.splice(i, 1);
          if (notauthorized.obniz_ws) {
            notauthorized.disconnectDevice(1000, 'authroize timeout');
            logger.debug(
              `over ${timeout / 1000} seconds being unauthorized ${notauthorized.id
              }`
            );
          }
        }
      }
    });
  }

  start(obj: any) {
    if (this.wsServer) {
      return;
    }
    this.wsroom_id = obj.wsroom_id;
    this.wsServer = new WSServer({
      server: obj.server,
      verifyClient: (info, accept) => {
        logger.debug(`Verify Client: ${info.req.url}`);
        return verifyClient(
          info,
          accept,
          this.wsroom_id,
          this._authorizedRooms
        );
      },
      maxPayload: 10 * 1000 * 1000, // 10MB max
      clientTracking: false,
    });
    this.wsServer.on('connection', (ws: WebSocket, req: any) => {
      return this.onConnect(ws, req);
    });
    this.wsServer.on('error', (error) => {
      logger.error(error);
    });
    this.wsServer.on('listening', () => {
      logger.info(`WSS listening`);
    });
  }

  onConnect(ws: WebSocket, req: any) {
    const obniz_id_int = parseObnizId(req.urlObj);
    // obniz.jsなどからの接続
    if (isClientWsRequest(req.urlObj)) {
      this.onUserConnect(ws, req, obniz_id_int as number);
      // デバイスからの接続
    } else if (isObnizWsRequest(req.urlObj)) {
      this.onObnizConnect(ws, req);
    } else {
      try {
        ws.close(1000, 'invalid request');
      } catch (e) {
        logger.error(e);
      }
    }
  }

  onUserConnect(ws: WebSocket, req: any, obniz_id_int: number) {
    const deviceRoom = this._authorizedRooms[obniz_id_int];
    if (!deviceRoom) {
      try {
        ws.close(1000, 'obniz ' + obniz_id_int + ' is not online');
      } catch (e) {
        logger.error(e);
      }
      return;
    }

    const maxClients = deviceRoom.maxWsClients;
    if (deviceRoom.clientWss.length >= maxClients) {
      const pretty_id = viewutil.pretty_id(obniz_id_int);
      const msg = `obniz=${pretty_id} is connected from ${maxClients} clients (it's max). Disconnect others or extend limit.`;
      logger.info(msg);
      const obj = [
        {
          debug: {
            error: {
              message: msg,
              code: 'NO_AVAILABLE_WS',
            },
          },
        },
      ];
       
      ws.send(JSON.stringify(obj));
       
      ws.close(1000, msg);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const obniz_js_ver = req.urlObj.searchParams.get('obnizjs');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const accept_binary = req.urlObj.searchParams.get('accept_binary');

    const global_ip =
      req.headers['x-real-ip'] ||
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress;
    deviceRoom.addClientWs(
      ws,
      {
        obniz_js_ver,
        accept_binary,
      },
      {
        headers: req.headers,
        global_ip,
      }
    );
  }

  onObnizConnect(ws: WebSocket, req: any) {
    const obniz = req.obniz;
    const info = ReqHeader.parseHeader(req.headers, req);

    // MESH NetworkでRootならRootObnizを代入
    if (info.net && info.net.root) {
      info.net.root_obniz = viewutil.pretty_id(obniz.id);
    }

    // Create Room for websocket.
    const room = new Room(obniz, ws, info, this);

    // store it
    this._notAuthorizedRooms.push(room);

    // Send authenticate request
    room.authorize();
  }

  removeUnAuthorized(room: Room) {
    for (let i = 0; i < this._notAuthorizedRooms.length; i++) {
      const notauthorized = this._notAuthorizedRooms[i];
      if (notauthorized === room) {
        this._notAuthorizedRooms.splice(i, 1);
        break;
      }
    }
  }

  //* **************************/
  // Room Delegate
  //* **************************/

  // websocket接続済みobnizの認証が完了した
  onAuthorized(anRoom: Room) {
    const authTime = new Date();
    this.removeUnAuthorized(anRoom);
    const existRoom = this._authorizedRooms[anRoom.id];
    if (existRoom) {
      if (existRoom !== anRoom) {
        logger.warn('' + anRoom.id + ' force close previous room');
        this._authorizedRooms[anRoom.id] = anRoom;
        existRoom.delegate = undefined; // ondisconnectを呼ばせない
        existRoom.disconnectDevice(1000, 'duplicated');
        this.onObnizReplaced(anRoom, authTime); // そしてondisconnect->onconnectをシーケンシャルに呼ぶ
        logger.warn(`${anRoom.id} silent switch to new device websocket`);
      } else {
        logger.warn('' + anRoom.id + ' is double authorized!!');
      }
    } else {
      this._authorizedRooms[anRoom.id] = anRoom;
      this.onObnizConnected(anRoom, authTime);
    }
  }

  // 認証済みobnizがofflineになった。
  onObnizDisconnect(
    anRoom: Room,
    disconInfo: any,
    disconnectAt: Date | null = null
  ) {
    if (this._authorizedRooms[anRoom.id] === anRoom) {
      const disconnectTime = disconnectAt ? disconnectAt : new Date();

      delete this._authorizedRooms[anRoom.id];
      this.onObnizDisConnected(anRoom, disconnectTime);
    } else {
      this.removeUnAuthorized(anRoom);
    }
  }

  // クラッシュログを始めとするファイル保存リクエスト
  onObnizRequestFileSave(
    anRoom: Room,
    obniz: any,
    filename: string,
    buffer: any,
    mode: any
  ) { }

  // ログ(ボタン押された。ほか)
  onLog(anRoom: Room, json: any) {
    this.log(anRoom, json);
  }

  // デバイスの情報送信(wifi apなど)
  onInfo(anRoom: Room, json: any) {
    this.info(anRoom, json);
  }

  /**
   * apiからメッセージングリクエストが来た
   * @param {Room} anRoom
   * @param {object} message
   * @param {*} from
   * @returns
   */
  onMsgRequest(anRoom: Room, message: any, from: any) {
    const to = message.to;
    const data = message.data;
    if (!to || typeof to != 'object' || !to[0]) {
      return;
    }
    for (let i = 0; i < to.length; i++) {
      const dest = viewutil.parse_pretty_id(to[i]);
      if (dest) {
        const payload = {
          data,
          from,
        };
        const foundInThisNodejsApp = this.dispatchMsgToClients(dest, payload);
        if (!foundInThisNodejsApp) {
          this.dispatchMsgToOuterWorld(dest, payload);
        }
      }
    }
  }

  /** *************************/
  // Exposed
  /** *************************/

  authorizedRooms() {
    return this._authorizedRooms;
  }

  connectedObnizInfo() {
    const ret: any = {};
    for (const id in this._authorizedRooms) {
      ret[id] = {};
    }
    return ret;
  }

  dispatchJson(obniz_id: any, json: any) {
    const room = this._authorizedRooms[obniz_id];
    if (room) {
      if (Array.isArray(json)) {
        for (const obj of (json as any[])) {
          room.executeJson(obj, null);
        }
      } else {
        room.executeJson(json, null);
      }
      return true;
    }
    return false;
  }

  dispatchMsgToClients(obniz_id: any, json: any) {
    const room = this._authorizedRooms[obniz_id];
    if (room) {
      room.dispatchMsgToClients(
        JSON.stringify([
          {
            message: json,
          },
        ]),
        null
      );
      return true;
    }
    return false;
  }

  updateObnizInfo = (obniz_id: any) => {
    getObnizInfo(this.wsroom_id as string, obniz_id, (err, obniz) => {
      if (err) {
        logger.error(err);
        return;
      }
      if (obniz) {
        const room = this._authorizedRooms[obniz_id];
        if (room) {
          room.updateObnizInfo(obniz);
        }
      }
    });
  };
}
