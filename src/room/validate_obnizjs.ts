import semver from 'semver';
import { WebSocket } from 'ws';

import { logger } from '../logger';
import Room from './index';

export default (room: Room, ws: WebSocket): void => {
  const minSupportObnizJs = minSupportObnizJsVersion(room.info.os_version);
  const obniz_js_ver = (ws as any).query.obniz_js_ver; // pythonとかなら存在しない

  // version check
  if (obniz_js_ver && semver.lt(obniz_js_ver, minSupportObnizJs)) {
    try {
      ws.send(
        JSON.stringify([
          {
            debug: {
              warning: {
                message: `Update obniz.js ${minSupportObnizJs} or higher to control obnizOS ${room.info.os_version}. see https://obniz.com/doc/cloud_device/ota`,
              },
            },
          },
        ])
      );
      // ws.close(1000, "you need to update obniz.js"); // イチイチ切断していると使えなくなるだいたい五感があるのに動かなくなるexampleとかが膨大になってしまう。
    } catch (e) {
      logger.error(e);
    }
    return;
  }
};

function minSupportObnizJsVersion(firmwareVer: string) {
  if (semver.gte(firmwareVer, '3.0.0')) {
    // 3.0.0以上のfirmなら3.0.0以上のjsが必要
    return '3.0.0';
  }

  if (semver.gte(firmwareVer, '2.0.0')) {
    // 2.0.0以上のfirmなら2.0.0以上のjsが必要
    return '2.0.0';
  }

  return '0.0.0';
}
