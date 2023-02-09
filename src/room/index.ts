import moment from 'moment';
import semver from 'semver';
import crypto from 'crypto';
import { ec as EC } from 'elliptic';
const ec192 = new EC('p192'); // for ESP32
const ec256 = new EC('p256'); // for CC3235 SECP256R1( = p256)

import { logger } from '../logger';
import * as viewutil from '../utils/obniz';

import { createCommandManager } from 'obniz/dist/src/obniz/libs/wscommand';

const timeout = 30 * 1000;
const WS_BUFFER_MAX_EACH_ROOM = 2 * 1000 * 1000;

export default class Room {
  public id: number;
  public info: any;
  public id_pretty: string;
  public obniz: any;
  public obniz_ws: any;
  public clientWss: WebSocket[];
  public authenticated: boolean;
  public delegate: any;
  public created_at: number;
  public maxWsClients = 1;

  protected wsCommandManager = createCommandManager();

  protected sign_message?: any = null

  protected blockPingUntil: number | null;
  protected pingInterval: number | null;
  protected reset_obniz_on_ws_disconnection: boolean;
  protected clientWsLimitedTime: number | null;
  protected shouldLogAllWs: boolean;
  protected liveCheckCallbacks: any[];
  protected bufferBandLimit: number;

  protected moduleSystem?: any | null = null;
  // protected moduleSubnet?: any | null = null;
  protected moduleDisplay?: any | null = null;

  protected ui?: any | null;

  protected authorizeTimeout: NodeJS.Timeout | null = null;

  protected subnetInfoUpdatdTime: number = 0;
  protected isNodeOfSubnet: boolean = false;
  protected subnetNodeRooms: any = {};
  protected subnetWaitings: any = {};
  protected subnetNodes: any[] = [];

  constructor(obniz: any, ws: WebSocket, info: any, delegate: any) {
    this.id = obniz.id;
    this.obniz = obniz;
    this.id_pretty = viewutil.pretty_id(this.id);
    this.obniz_ws = ws;
    this.obniz_ws.lastReceiveTime = Date.now();
    this.info = info;

    this.delegate = delegate;

    this.created_at = Date.now(); // roomの作成日時
    this.clientWss = [];
    this.authenticated = false;

    // config
    this.pingInterval = null; // pingIntervalを超えて無通信だったらpingを打つ。null = default for 30sec
    this.reset_obniz_on_ws_disconnection = false;
    // =========================//
    // live checks
    this.blockPingUntil = null;
    this.liveCheckCallbacks = [];

    this.shouldLogAllWs =
      process.env.NODE_ENV !== 'production' ||
      process.env.SHOULD_LOG_WS === 'all';

    // 帯域制限がかかるobnizデバイス側へのbuffer
    this.bufferBandLimit = WS_BUFFER_MAX_EACH_ROOM;
    // 帯域制限がかかってからの経過時間
    this.clientWsLimitedTime = null;

    this.bindModules();

    this.updateFromObniz(obniz);
    this._addObnizWsHandlers(ws);
  }

  /**
   * オンライン直後またはユーザーが管理画面で変更すると呼ばれる。
   * @param {obniz} obniz
   */
  updateFromObniz(obniz: any) {
    // Clients Max Connections
    this.maxWsClients = 1;
    if (typeof obniz.metadata.max_ws_clients === 'number') {
      this.maxWsClients = obniz.metadata.max_ws_clients;
    }
    this.info.max_ws_clients = this.maxWsClients;
    if (this.clientWss.length >= this.maxWsClients) {
      this.disconnectAllClients();
    }
    // Ping Check Interval
    if (
      this.authenticated &&
      typeof obniz.ping_interval === 'number' &&
      this.pingInterval !== obniz.ping_interval
    ) {
      this.updatePingInterval(obniz.ping_interval);
    }
  }

  /**
   * Update ping Interval
   * @param {number} pingInterval
   */
  updatePingInterval(pingInterval: number) {
    this.pingInterval = pingInterval;
    if (semver.gt(this.info.os_version, '3.5.1')) {
      if (this.moduleSystem && typeof this.moduleSystem.updatePingCheckInterval === 'function') {
        this.moduleSystem?.updatePingCheckInterval(pingInterval);
      }
    }
  }

  bindModules() {
    this.wsCommandManager.createCommandInstances();
    this.wsCommandManager.setHw({
      hw: this.obniz.hw,
      firmware: this.info.os_version,
    })
    this.moduleSystem = this.wsCommandManager.getCommandInstance('WSCommandSystem');
    this.moduleDisplay = this.wsCommandManager.getCommandInstance('WSCommandDisplay');
  }

  /*
   * obnizをつないでていても良いのかを判定する。
   * client側はその都度常に検証されるからこれを呼ぶ必要はない
   */
  validateLicense() {
    if (!this.obniz_ws) {
      // ghost
      return;
    }
    this.ui?.reload();
  }

  /**
   * 取得済みのobnizの情報が更新された。自分では呼び出さず外部から呼ばれる
   * @param {*} obniz
   */
  updateObnizInfo(obniz: any) {
    logger.debug(`obniz ${this.id} info updated to ${JSON.stringify(obniz)}`);
    /* need to updat econnection */
    const need_disconnect_keys = ['status', 'region', 'wsredirect', 'hw', 'os'];
    for (const key of need_disconnect_keys) {
      if (obniz[key] !== this.obniz[key]) {
        logger.debug(
          `obniz ${this.id} ${key} changed from ${this.obniz[key]} to ${obniz[key]}. disconnect now`
        );
        this.disconnectDevice(1000, 'setting updated');
        return;
      }
    }
    if (
      (obniz.owner && !this.obniz.owner) ||
      (!obniz.owner && this.obniz.owner) ||
      (obniz.owner &&
        this.obniz.owner &&
        obniz.owner.plan !== this.obniz.owner.plan)
    ) {
      logger.debug(`obniz ${this.id} changed owner plan. disconnect now`);
      this.disconnectDevice(1000, 'owner or owner plan changed');
      return;
    }
    /* need to cut off client */
    const need_disconnect_clients_keys = ['webapp_id', 'access_token'];
    for (const key of need_disconnect_clients_keys) {
      // キーとしてdiffにある？そしてそれに差異がある？
      if (obniz[key] !== this.obniz[key]) {
        logger.debug(
          `obniz ${this.id} ${key} changed from ${this.obniz[key]} to ${obniz[key]}. disconnect clients now`
        );
        this.disconnectAllClients();
      }
    }
    // No needs to disconnect clients
    if (
      obniz.metadata.max_ws_clients !== this.maxWsClients ||
      obniz.ping_interval !== this.pingInterval
    ) {
      this.updateFromObniz(obniz);
    }
    this.obniz = obniz;

    this.validateLicense();
    this.notifyInfo();
  }

  isWiFiNetwork() {
    return (
      typeof this.info.net === 'object' &&
      this.info.net !== null &&
      this.info.net.net === 'wirelesslan'
    );
  }

  isMeshNetwork() {
    return false;
  }

  /**
   *
   * @param {*} ws
   */
  _addObnizWsHandlers(ws: any) {
    ws.on('message', (message: any) => {
      ws.lastReceiveTime = Date.now();
      if (typeof message === 'string') {
        if (this.shouldLogAllWs) {
          logger.debug(`d[${this.id}] msg: ${message}`);
        }
        this.dispatchMsgToClients(message);
      } else {
        if (this.shouldLogAllWs) {
          const arr: any = [];
          message.forEach(function (val: any, index: any) {
            arr.push(val.toString(16));
          });
          logger.debug(`d[${this.id}] binary: <Buffer ${arr.join(' ')}>`);
        }
        this._didNotifyBinaryFromObniz(message);
      }
      // consider disable limit
      if (this.clientWsLimitedTime) {
        this.tryResumeClients();
      }
      this.didAcknoledgeAlive();
    });
    ws.on('close', (code: any, reason: any) => {
      logger.info(`d [${this.id}] closed: ${code} ${reason}`);
      const disconnectAt = new Date();
      this.afterObnizDisconnected(code, reason, disconnectAt);
    });
    ws.on('ping', () => {
      if (this.shouldLogAllWs) {
        logger.debug(`d [${this.id}] on ping`);
      }
      ws.lastReceiveTime = Date.now();
      // consider disable limit
      if (this.clientWsLimitedTime) {
        this.tryResumeClients();
      }
      this.didAcknoledgeAlive();
    });
    ws.on('pong', () => {
      if (this.shouldLogAllWs) {
        const duration = Date.now() - ws.pingged_at;
        logger.debug(`d [${this.id}] on pong (duration: ${duration} ms)`);
      }
      ws.pingged_at = null;
      ws.lastReceiveTime = Date.now();
      this.didAcknoledgeAlive();
    });
    ws.on('unexpected-response', (request: any, response: any) => {
      logger.error(`[${this.id}] unexpected-response`);
    });
    ws.on('error', (error: any) => {
      logger.error(`[${this.id}] error ` + error, { notify: false });
    });
  }

  authorize() {
    const pubkeyExist = this.obniz.pubkey != null;
    const skip_authorize = true;
    if (!pubkeyExist || skip_authorize) {
      logger.warn('[' + this.id + '] should not verification');
      this.authenticated = true;
      this.didAuthoriezed();
    } else {
      logger.info('[' + this.id + '] sent sign request');
      this.sign();
      this.authorizeTimeout = setTimeout(() => {
        this.disconnectDevice(1000, 'not authorized');
      }, timeout);
    }
  }

  /**
   * あるnodeにHTTP Websocket Requestを送るように指示
   * @param {*} subnetId macaddress
   */
  sendJoinRequestToSubnet(subnetId: any) {

  }

  /**
   * あるnodeをOnlineにする。HTTP Websocket Requestを元に送信
   * @param {*} subnetId
   */
  sendOnlineToSubnet(subnetId: any) {

  }

  /**
   * ws.js のcronより10secごとに呼ばれる
   */
  healthCheck() {
    if (this.shouldLogAllWs) {
      logger.debug(`[${this.id}] start healthCheck`);
    }
    // 帯域制限中なら解除できないか検討する
    if (this.clientWsLimitedTime) {
      this.tryResumeClients();
    }

    // check must to do ping
    const currentTime = Date.now();
    if (this.blockPingUntil && currentTime < this.blockPingUntil) {
      return;
    }

    const isMeshNetwork = this.isMeshNetwork();
    const isMeshChildNode = isMeshNetwork && this.isNodeOfSubnet === true;

    // MESHのrootnodeで、最後のデータから3分経っていたら
    if (isMeshNetwork && !isMeshChildNode) {
      // rootnodeに対して定期的なsubnet更新を要求
      if (this.subnetInfoUpdatdTime + 3 * 60 * 1000 < currentTime) {
        // Attention: 多重に呼ぶことがありえる。
        // this.moduleSubnet.requestAllSubnet();
        logger.debug(`${this.id} sent request all subnet`);
      }
      for (const subnetId in this.subnetWaitings) {
        if (this.isHeaderRecievedSubnet(subnetId)) {
          delete this.subnetWaitings[subnetId];
          continue;
        }
        // 2分以上も子供が接続できていない
        const recognizedTime = this.subnetWaitings[subnetId];
        if (recognizedTime + 2 * 60 * 1000 < currentTime) {
          logger.warn(
            `${this.id} too much waiting time for subnetId ${subnetId}. going reboot root node`
          );
          // suspect command parser
          this.moduleSystem?.reboot();
          return;
        }
      }
    }

    const sockets = [this.obniz_ws];
    sockets.push(...this.clientWss);
    for (let i = 0; i < sockets.length; i++) {
      const socket = sockets[i];
      if (socket.readyState !== 1) {
        if (this.shouldLogAllWs) {
          const prefix = socket === this.obniz_ws ? `d` : `c`;
          logger.debug(
            `${prefix}[${this.id}] skip health check socket.readyState: ${socket.readyState}`
          );
        }
        continue;
      }

      // 無通信でpingを打つまでの時間
      let lastConInterval =
        isMeshNetwork && socket === this.obniz_ws ? 60 * 1000 : 15 * 1000;
      // pingを打ったのにpongが来なくて切断するまでの時間
      const timeoutInterval =
        isMeshNetwork && socket === this.obniz_ws ? 60 * 1000 : 30 * 1000;

      if (typeof this.pingInterval === 'number') {
        lastConInterval = this.pingInterval;
      }

      if (this.shouldLogAllWs) {
        const prefix = socket === this.obniz_ws ? `d` : `c`;
        logger.debug(
          `${prefix}[${this.id}] lastConInterval:${lastConInterval}, timeoutInterval:${timeoutInterval} currentTime:${currentTime}, lastReceiveTime:${socket.lastReceiveTime}, pingged_at:${socket.pingged_at} `
        );
      }

      if (socket.lastReceiveTime + lastConInterval < currentTime) {
        if (!socket.pingged_at) {
          // ping打つべき
          if (this.shouldLogAllWs) {
            const prefix = socket === this.obniz_ws ? `d` : `c`;
            logger.debug(`${prefix}[${this.id}] ping to one: ${this.obniz.id}`);
          }
          socket.ping();
          socket.pingged_at = currentTime;
        } else if (socket.pingged_at + timeoutInterval < currentTime) {
          // pingを打ってから30secも何もなかった
          if (socket === this.obniz_ws) {
            logger.info(`d[${this.id}] pingpong timeout`);
            this.disconnectDevice(1000, 'ping pong timeout');
          } else {
            logger.info(`c[${this.id}] ping pong timeout`);
            this.disconnectClient(socket, 1000, 'ping pong timeout');
          }
        }
      } else if (socket.lastReceiveTime >= socket.pingged_at) {
        // ping以降何かしら通信があった。＝＞pingは無効化
        // また、pongが速すぎて時刻が一緒の場合がある。
        // pongが返ってきたら
        socket.pingged_at = null;
        if (this.shouldLogAllWs) {
          const prefix = socket === this.obniz_ws ? `d` : `c`;
          logger.debug(
            `${prefix}[${this.id}] delete pong waiting: ${this.obniz.id}`
          );
        }
      }
    }
  }

  updateNetworkInfo() {
    // WiFi RSSI更新
    if (this.isWiFiNetwork() && semver.major(this.info.os_version) >= 5) {
      // 5.0.0 以降でreal time 更新
      if (this.moduleSystem && typeof this.moduleSystem.getApInfo === 'function') {
        this.moduleSystem?.getApInfo(); // onApInfoReceived()で受け取る。
      }
    }
  }

  didAuthoriezed() {
    if (this.delegate) {
      this.delegate.onAuthorized(this);
    }

    // localIPなど今の情報をobniz.comに送ってしまう
    this.notifyInfo();

    if (semver.gte(this.info.os_version, '3.3.0')) {
      // アクセスポイント情報を取得する
      // AK-030などは3.3.0以上で返答がないバージョンがある
      if (this.moduleSystem && typeof this.moduleSystem.getApInfo === 'function') {
        this.moduleSystem?.getApInfo(); // onApInfoReceived()で受け取る。
      }
    }
    // デフォルトではない値が設定されている。
    if (typeof this.obniz.ping_interval === 'number') {
      this.updatePingInterval(this.obniz.ping_interval);
    }
    // QR画面にする
    if (this.ui) {
      this.ui.didConnectedDevice();
    }
  }

  sign() {
    const message = Buffer.allocUnsafe(0x3f); // ESPが一度にcallbackを呼ぶ最大値
    for (let i = 0; i < message.byteLength; i++) {
      message[i] = Math.floor(Math.random() * (0xff + 1));
    }
    this.sign_message = message;
    if (this.moduleSystem && typeof this.moduleSystem.sign === 'function') {
      this.moduleSystem?.sign(message);
    }
  }

  /**
   * そのsubnetIdがこのRoot Nodeの子供で、かつ少なくともrequestHeaderを送ってきたのかどうか。
   * @param {*} subnetId
   * @returns
   */
  isHeaderRecievedSubnet(subnetId: any) {
    for (const existId in this.subnetNodeRooms) {
      if (existId === subnetId) {
        return true;
      }
    }
    return false;
  }

  onSignatureReceived(recv_hash: any, signature: any) {
    if (this.authorizeTimeout) {
      clearTimeout(this.authorizeTimeout);
      this.authorizeTimeout = null;
    }

    let verified = false;
    try {
      if (this.obniz.hw === 'cc3235mod') {
        const key = ec256.keyFromPublic(this.obniz.pubkey, 'hex');
        verified = key.verify(recv_hash, signature);
      } else {
        const key = ec192.keyFromPublic(this.obniz.pubkey, 'hex');
        verified = key.verify(recv_hash, signature);
      }
    } catch (e: any) {
      logger.warn(
        e
          ? `${e.message}\n${e.stack}`
          : `undefined error on onSignatureReceived`
      );
      verified = false;
    }
    if (verified) {
      logger.info('authenticated ' + this.id);
      this.authenticated = true;
      this.didAuthoriezed();
    } else {
      logger.warn(`
      cant verify obniz ${this.id} ${this.obniz.hw}
      sent message: ${this.sign_message.toString('hex')}
      sent digest: ${crypto
          .createHash('sha256')
          .update(this.sign_message, 'utf8')
          .digest()
          .toString('hex')}
      recv hash  : ${recv_hash && typeof recv_hash.toString === 'function'
          ? recv_hash.toString('hex')
          : ''
        }
      recv signature: ${signature.toString('hex')}`);
    }
    delete this.sign_message;
  }

  /**
   * 自分とそのSubnetの一覧をデバイスから受信。
   */
  onSubnetTableReceived(subnetNodes: any[]) {
    this.subnetInfoUpdatdTime = Date.now();
    // 変化を検知
    let changed = this.subnetNodes.length !== subnetNodes.length;
    if (!changed) {
      for (let i = 0; i < this.subnetNodes.length; i++) {
        if (this.subnetNodes[i] !== subnetNodes[i]) {
          changed = true;
          break;
        }
      }
    }
    // 変化があった場合に再編成を行う
    if (changed) {
      this.subnetNodes = subnetNodes;
      if (this.delegate) {
        this.delegate.onSubnetUpdated(this, subnetNodes);
      }
      this.notifyInfo();
      // 新しい子供の時間を計測
      for (const node of this.subnetNodes) {
        if (!this.subnetWaitings[node]) {
          logger.debug(`${this.id} found new child`);
          this.subnetWaitings[node] = Date.now(); // 発見時刻を記録
        }
      }
      for (const existId in this.subnetWaitings) {
        let found = false;
        for (const listed of this.subnetNodes) {
          if (listed === existId) {
            found = true;
            break;
          }
        }
        if (!found) {
          logger.debug(`${this.id} disappear waiting subnet id ${existId}`);
          delete this.subnetWaitings[existId];
        }
      }
    }
  }

  notifyInfo() {
    if (this.delegate) {
      // reqHeaders
      this.info.clients_count = this.clientWss.length;
      this.info.clients = [];
      this.info.subnet_nodes = this.subnetNodes;
      for (const ws of this.clientWss as any[]) {
        this.info.clients.push({
          global_ip: ws.global_ip,
          obniz_js_ver: ws.query.obniz_js_ver,
          origin: ws.reqHeaders.origin,
          'user-agent': ws.reqHeaders['user-agent'],
        });
      }

      // notify
      this.delegate.onInfo(this, {
        info: this.info,
      });
    }
  }

  onApInfoReceived(info: any) {
    this.info.apinfo = info;
    this.notifyInfo();
  }

  /**
   * obniz.jsからの接続
   * @param {Websocket} ws
   * @param {object} query
   * @param {object} info
   */
  addClientWs(ws: any, query: any, info: any) {
    ws.query = query;
    ws.global_ip = info.global_ip;
    ws.reqHeaders = {};
    if (info.headers && info.headers.origin) {
      ws.reqHeaders.origin = info.headers.origin;
    }
    if (info.headers && info.headers['user-agent']) {
      ws.reqHeaders['user-agent'] = info.headers['user-agent'];
    }
    ws.lastReceiveTime = Date.now();

    const isMeshNetwork = this.isMeshNetwork();

    // 同じグローバルIP
    const canLocalConnect =
      isMeshNetwork === false &&
      info.global_ip &&
      this.info.global_ip &&
      info.global_ip === this.info.global_ip;

    // clients
    this.liveCheckCallbacks.push(() => {
      if (ws.readyState !== 1) {
        // 待ってる間に切れた
        return;
      }
      // pongが返ってきた => readyに切り替える。ready来るまでjsは待機する
      const connected_network: any = {
        online_at: this.created_at,
        local_ip: this.info.local_ip,
        global_ip: this.info.global_ip,
        net: 'unknown',
      };

      // 古いOSだとapinfoにwifi情報はあってもnetがない
      if (this.info.net || this.info.apinfo) {
        if (this.info.net && this.info.net.net) {
          connected_network.net = this.info.net.net;
        }
        if (this.info.apinfo) {
          const ap = this.info.apinfo[0];
          if (connected_network.net === 'wifimesh') {
            connected_network.wifimesh = {
              ssid: ap.ssid,
              rssi: ap.rssi,
              layer: this.info.net.layer,
              meshid: this.info.net.meshid,
              parent_obniz_id: this.info.net.parent_obniz,
              root_obniz_id: this.info.net.root_obniz,
            };
          } else {
            connected_network.net = 'wirelesslan';
            connected_network.wifi = {
              ssid: ap.ssid,
              mac_address: ap.macAddress,
              rssi: ap.rssi,
            };
          }
        }

        if (
          this.info.net?.net === 'cellularmodule' || this.info.net?.imsi
        ) {
          connected_network.net = 'cellular';
          connected_network.cellular = {
            imsi: this.info.net.imsi,
            imei: this.info.net.imei,
            iccid: this.info.net.iccid,
            cnum: this.info.net.cnum,
            rssi: this.info.net.rssi,
          };
        }
      } else {
        connected_network.net = 'unknown';
      }

      const ready = {
        ws: {
          ready: true,
          obniz: {
            hw: this.obniz.hw,
            firmware: this.info.os_version,
            metadata: JSON.stringify(this.obniz.user_metadata || {}),
            connected_network,
          },
        },
      };
      let alreadyLocalConnected = false;
      for (const anWs of this.clientWss as any[]) {
        if (anWs.isUsingLocalConnect) {
          alreadyLocalConnected = true;
        }
      }

      if (canLocalConnect && !alreadyLocalConnected) {
        ws.isUsingLocalConnect = true;
        (ready.ws as any).local_connect = {
          ip: this.info.local_ip,
        };
      }

      try {
        ws.send(JSON.stringify([ready]));
        // ValidateJsVersion(this, ws); // obniz.jsのバージョン警告
        if (alreadyLocalConnected) {
          // 誰かがlocalconnectしている。
          this.warning(
            ws,
            `obniz ${this.id} is locally connected from another program. You never recieve any data from a obniz device.`
          );
        }
        // RECORD CCLIENT ONLINE HERE
        // 
      } catch (e) {
        logger.error(e);
      }
      this.notifyInfo();
    });

    this.clientWss.push(ws);
    if (this.clientWss.length === 1) {
      if (this.ui) {
        this.ui.didConnectedFirstClient();
      }
    }

    // イベントハンドラ
    ws.on('message', (message: any) => {
      ws.lastReceiveTime = Date.now();
      if (typeof message === 'string') {
        if (this.shouldLogAllWs) {
          logger.debug(`c [${this.id}] msg:  ${message}`);
        }
        let objArray;
        try {
          objArray = JSON.parse(message);
          if (!objArray) throw new Error('this is not json');
        } catch (e) {
          // logger.error(e); // この程度でいちいち出すんじゃない。
          this.warning(ws, e);
          return;
        }

        for (const key in objArray) {
          const obj = objArray[key];
          this.executeJson(obj, ws);
          if (this.delegate) {
            if (obj.message) {
              this.delegate.onMsgRequest(this, obj.message, this.id_pretty);
            }
          }
        }
      } else {
        if (this.shouldLogAllWs) {
          const arr: any[] = [];
          message.forEach(function (val: any, index: any) {
            arr.push(val.toString(16));
          });
          logger.debug(`c [${this.id}] binary: <Buffer ${arr.join(' ')}>`);
        }

        this.sendFramed(message); // By Passed.
      }
    });
    ws.on('close', (code: any, reason: any) => {
      logger.info('c [' + this.id + '] closed: ' + code + ' ' + reason);
      this.afterClientDisconnected(ws, code, reason);
    });
    ws.on('ping', () => {
      ws.lastReceiveTime = Date.now();
      if (this.shouldLogAllWs) {
        logger.debug(`c [${this.id}] on ping`);
      }
    });
    ws.on('pong', () => {
      ws.pingged_at = null;
      ws.lastReceiveTime = Date.now();
      if (this.shouldLogAllWs) {
        logger.debug(`c [${this.id}] on pong`);
      }
    });
    ws.on('unexpected-response', (request: any, response: any) => {
      logger.error(`c [${this.id}] unexpected-response`);
    });
    ws.on('error', (error: any) => {
      logger.error(`c [${this.id}] error` + error, { notify: false });
    });

    // this.obniz_ws.ping();
    this.didAcknoledgeAlive();
  }

  /**
   * Pongまたはデータを受け取るなど、生存確認が出来た。
   * もし待機中のws clientがいたらonlineであることを伝える。
   */
  didAcknoledgeAlive() {
    while (this.liveCheckCallbacks.length) {
      const callback = this.liveCheckCallbacks.pop();
      callback(null);
    }
  }

  disconnectAllClients(code?: number, reason?: string) {
    if (this.clientWsLimitedTime) {
      this.resumeClients();
    }
    while (true) {
      const ws = this.clientWss[0];
      if (ws) {
        this.disconnectClient(ws, code, reason);
      } else {
        break;
      }
    }
    // clear all pong waiting callbacks
    this.liveCheckCallbacks = [];
  }

  disconnectClient(ws: any, code: any, reason: any) {
    if (!ws) {
      return;
    }
    const shouldRemoveObservers = [
      'message',
      'ping',
      'pong',
      'unexpected-response',
      'close',
    ];
    for (let ii = 0; ii < shouldRemoveObservers.length; ii++) {
      ws.removeAllListeners(shouldRemoveObservers[ii]);
    }
    ws.close(code || 1000, reason || 'obniz ' + this.id + ' was disconnected');
    this.afterClientDisconnected(ws, code, reason);
  }

  afterClientDisconnected(ws: any, code: any, reason: any) {
    for (let i = 0; i < this.clientWss.length; i++) {
      if (this.clientWss[i] === ws) {
        const shouldRemoveObservers = [
          'message',
          'ping',
          'pong',
          'unexpected-response',
          'close',
        ];
        for (let ii = 0; ii < shouldRemoveObservers.length; ii++) {
          ws.removeAllListeners(shouldRemoveObservers[ii]);
        }

        this.clientWss.splice(i, 1);
        // RECORD client_offline here
        // reset obniz if needed
        if (
          this.obniz_ws.readyState === 1 &&
          this.clientWss.length === 0 &&
          this.reset_obniz_on_ws_disconnection
        ) {
          if (this.moduleSystem && typeof this.moduleSystem.hardReset === 'function') {
            this.moduleSystem?.hardReset();
          }
          if (this.ui) {
            this.ui.didDisonnectedAllClient();
          }
          if (this.shouldLogAllWs) {
            logger.debug('d[' + this.id + '] OLED changed to QR');
          }
        }
        break;
      }
    }
    this.notifyInfo();
  }

  disconnectDevice(code: any, reason: any) {
    if (!this.obniz_ws) {
      return;
    }
    try {
      const shouldRemoveObservers = [
        'message',
        'ping',
        'pong',
        'unexpected-response',
        'close',
      ];
      for (let i = 0; i < shouldRemoveObservers.length; i++) {
        this.obniz_ws.removeAllListeners(shouldRemoveObservers[i]);
      }
      if (this.obniz_ws.readyState === 1) {
        this.obniz_ws.close(code || 1000, reason || 'duplicated');
      }
      // RECORD device_offline here
    } catch (err) {
      if (err) logger.error(err);
    }
    this.afterObnizDisconnected(code, reason);
  }

  afterObnizDisconnected(code: any, reason: any, date: any = null) {
    // clear subnet
    for (const key in this.subnetNodeRooms) {
      const room = this.subnetNodeRooms[key];
      room.onParentClosed();
    }

    if (this.authorizeTimeout) {
      clearTimeout(this.authorizeTimeout);
      this.authorizeTimeout = null;
    }
    this.disconnectAllClients();
    if (this.obniz_ws) {
      const shouldRemoveObservers = [
        'message',
        'ping',
        'pong',
        'unexpected-response',
        'close',
      ];
      for (let i = 0; i < shouldRemoveObservers.length; i++) {
        this.obniz_ws.removeAllListeners(shouldRemoveObservers[i]);
      }
    }
    delete this.obniz_ws;
    if (this.delegate) {
      this.delegate.onObnizDisconnect(this, { code, reason }, date);
    }

    if (this.ui && this.ui.current) {
      delete this.ui.current.room;
      delete this.ui.current;
    }
    if (this.ui) {
      delete this.ui.room;
      delete this.ui;
    }

    // 循環参照のリスクなし
    // this.wsCommandManager = null;

    delete this.delegate;
    // そしてGCの回収を待つ
  }

  dispatchMsgToClients(msg: any, exceptfor: any = null) {
    if (this.shouldLogAllWs) {
      if (typeof msg === 'string') {
        logger.debug(`>c [${this.id}] msg:  ${msg}`);
      } else {
        const arr: any[] = [];
        msg.forEach(function (val: any, index: any) {
          arr.push(val.toString(16));
        });
        logger.debug(`>c [${this.id}] binary: <Buffer ${arr.join(' ')}>`);
      }
    }
    for (let i = 0; i < this.clientWss.length; i++) {
      const ws = this.clientWss[i];
      if (ws === exceptfor) continue;
      if (ws.readyState !== 1) continue;
      try {
        ws.send(msg);
      } catch (err: any) {
        if (
          err.code !== 'EPIPE' &&
          err.code !== 'ECONNRESET' &&
          err.code !== 'ERR_STREAM_DESTROYED'
        ) {
          logger.error(err);
        }
      }
    }
  }

  pauseSocket(socket: any) {
    if (socket && socket.readyState === 1 && socket._socket) {
      socket._socket.pause();
      if (this.shouldLogAllWs) {
        const prefix = socket === this.obniz_ws ? `d` : `c`;
        logger.debug(`${prefix}[${this.id}] pauseSocket`);
      }
    }
  }

  resumeSocket(socket: any) {
    if (socket && socket.readyState === 1 && socket._socket) {
      socket._socket.resume();
      if (this.shouldLogAllWs) {
        const prefix = socket === this.obniz_ws ? `d` : `c`;
        logger.debug(`${prefix}[${this.id}] resumeSocket`);
      }
    }
  }

  resumeClients() {
    for (const ws of this.clientWss) {
      this.resumeSocket(ws);
    }
  }

  tryResumeClients() {
    if (this.clientWsLimitedTime && this.obniz_ws) {
      const belowLimit =
        this.obniz_ws.bufferedAmount < this.bufferBandLimit * 0.5;
      const exceedTime = this.clientWsLimitedTime + 5 * 1000 < Date.now(); // 5秒以上経った
      if (belowLimit || exceedTime) {
        this.clientWsLimitedTime = null;
        logger.debug(
          `[${this.id}] resume sockets amout=${this.obniz_ws.bufferedAmount} exceedtime = ${exceedTime}`
        );
        this.resumeClients();
      }
    }
  }

  warning(ws: any, error: any) {
    if (!ws || ws.readyState !== 1) return;
    try {
      ws.send(
        JSON.stringify([
          {
            debug: {
              warning: {
                message: '' + error,
              },
            },
          },
        ])
      );
    } catch (e) {
      logger.error(e);
    }
  }

  error(ws: any, error: any) {
    if (!ws || ws.readyState !== 1) return;
    try {
      ws.send(
        JSON.stringify([
          {
            debug: {
              error: {
                message: '' + error,
              },
            },
          },
        ])
      );
    } catch (e) {
      logger.error(e);
    }
  }

  // Obnizから届いたbinaryをそれぞれjsonにしてclientに送る。
  _didNotifyBinaryFromObniz(buf: any) {
    const received = buf;

    let canSendBinaryToClinets = true;

    const frames = [];
    while (true) {
      let frame;
      try {
        frame = this.wsCommandManager.dequeueOne(buf);
      } catch (e: any) {
        if (
          e &&
          typeof e.message === 'string' &&
          e.message.indexOf('reserved bit 1') >= 0
        ) {
          logger.warn(e);
        } else {
          logger.error(e);
        }
        this.disconnectDevice(1000, 'wscommand error');
        return;
      }
      if (!frame) break;
      try {
        frames.push(frame);
      } catch (e: any) {
        logger.warn(`${this.id} wscommand error ${e.message}`);
        this.disconnectDevice(1000, 'wscommand error');
        return;
      }
      buf = frame.next;
    }

    if (this.authenticated === false) {
      return;
    }

    //  1人でもユーザーがバイナリ拒否ならそもそも無理
    for (let i = 0; i < this.clientWss.length; i++) {
      if (!(this.clientWss[i] as any).query.accept_binary) {
        // 1つでもbinaryを受け付けられないならあきらめる。
        canSendBinaryToClinets = false;
        break;
      }
    }

    // ユーザーへ送る
    if (canSendBinaryToClinets) {
      // バイナリ送信可能なら送る
      this.dispatchMsgToClients(received);
    } else {
      // 無理ならjsonで送る
      const jsonArray = [];
      for (let frame_index = 0; frame_index < frames.length; frame_index++) {
        const frame = frames[frame_index];
        const result = this.wsCommandManager.frame2json(frame);
        if (Array.isArray(result)) {
          jsonArray.push(...result);
        } else if (typeof result === 'object') {
          jsonArray.push(result);
        } else {
          // 何もない場合は無視
        }
      }

      if (jsonArray.length > 0) {
        this.dispatchMsgToClients(JSON.stringify(jsonArray));
      }
    }
  }

  // クライアントから届いたjsonを処理してそれぞれbinaryにしてObinzに送る
  executeJson(json: any, clientWs: any) {
    try {
      if (
        clientWs &&
        typeof clientWs === 'object' && // APIで投げられた場合はnullなので。
        json.ws &&
        typeof json.ws === 'object' &&
        typeof json.ws.reset_obniz_on_ws_disconnection === 'boolean'
      ) {
        this.reset_obniz_on_ws_disconnection =
          json.ws.reset_obniz_on_ws_disconnection;
      }
      const frame = this.wsCommandManager.compress(json);
      this.sendFramed(frame);

    } catch (e) {
      this.error(clientWs, e);
    }
  }

  /**
   * obnizデバイス側に送信する
   * @param { binary data to be sent } framed
   */
  sendFramed(framed: any) {
    if (!this.obniz_ws || this.obniz_ws.readyState !== 1) {
      return;
    }
    if (this.shouldLogAllWs) {
      const arr: any[] = [];
      framed.forEach(function (val: any, index: any) {
        arr.push(val.toString(16));
      });
      logger.debug(`>>[${this.id}] <Buffer ${arr.join(' ')}>`);
    }

    try {
      this.obniz_ws.send(framed, (err: any) => {
        if (
          err &&
          err.code !== 'EPIPE' &&
          err.code !== 'ECONNRESET' &&
          err.code !== 'ERR_STREAM_DESTROYED'
        ) {
          logger.error(err);
        }
      });
    } catch (err: any) {
      if (
        err &&
        err.code !== 'EPIPE' &&
        err.code !== 'ECONNRESET' &&
        err.code !== 'ERR_STREAM_DESTROYED'
      ) {
        logger.error(err);
      }
    }

    // obnizデバイス側への送信が厳しそうであればclients側を絞る
    if (
      this.clientWsLimitedTime === null &&
      this.obniz_ws.bufferedAmount >= this.bufferBandLimit
    ) {
      logger.debug('[' + this.id + '] pause sockets');
      this.clientWsLimitedTime = Date.now();
      for (const ws of this.clientWss) {
        this.pauseSocket(ws);
      }
    }
  }
}
