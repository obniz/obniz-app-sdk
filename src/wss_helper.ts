import { URL } from 'url';
import { logger } from './logger';

import * as viewutil from './utils/obniz';

import * as ReqHeader from './room/obniz_req_header';
import Room from './room';

import * as ObnizCloudAPI from './obnizcloud/api';

export const verifyClient = (
  info: { [key: string]: any },
  accept: (accept: boolean, code?: number, message?: string) => void,
  wsroom_id: any,
  _authorizedRooms: any
): void => {
  logger.info('ws request ' + info.req.url);
  try {
    info.req.urlObj = new URL('http://localhost' + info.req.url);
  } catch (e) {
    logger.error('invalid url');
    accept(false, 403, 'INVALID URL');
    return;
  }
  if (isClientWsRequest(info.req.urlObj)) {
    // 正しいobniz id?
    const obniz_id = parseObnizId(info.req.urlObj);
    if (!obniz_id) {
      accept(false, 404, 'obniz ' + obniz_id + ' is not exist');
      logger.warn('refuse ws because not registrated obniz');
      return;
    }
    const deviceRoom = _authorizedRooms[obniz_id];
    if (!deviceRoom) {
      accept(false, 404, 'obniz ' + obniz_id + ' is not online');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    let authkey = info.req.urlObj.searchParams.get('access_token');
    if (!authkey) {
      authkey =
        info.req.headers.authorization || info.req.headers.Authorization;
    }
    // ping停止状態(=OTA中)
    if (deviceRoom.blockPingUntil) {
      accept(false, 404, 'obniz ' + obniz_id + ' is under OTA.');
      return;
    }
    // 認証
    if (deviceRoom.obniz.access_token) {
       
      ObnizCloudAPI.checkAuthority({
        wsroom_id,
        obniz_id,
        authkey,
      })
        .then(() => {
          accept(true);
        })
        .catch((e) => {
          accept(false, 401, 'not authorized');
          logger.warn(`obniz ${obniz_id} invalid access_token`);
        });
    } else {
      accept(true);
    }
  } else if (isObnizWsRequest(info.req.urlObj)) {
    const reqInfo = ReqHeader.parseHeader(info.req.headers, info.req);
    // 正しいobniz id?
    const obniz_id = parseObnizId(info.req.urlObj);
    if (!obniz_id) {
      accept(false, 404, 'obniz ' + obniz_id + ' is not exist');
      logger.warn('refuse ws because not registrated obniz');
      return;
    }

    const deviceRoom = _authorizedRooms[obniz_id];
    loadObnizInfo(wsroom_id, obniz_id, deviceRoom, (err, obniz) => {
      if (err || !obniz) {
        logger.error(err);
        accept(false, 500, 'server error');
        return;
      }
      // record online here
      info.req.obniz = obniz;
      info.req.obniz.hw = info.req.headers['obniz-device-identity'];

      // check license here
      accept(true);
    });
  } else {
    accept(false, 403, 'invalid format');
  }
};

function loadObnizInfo(
  wsroom_id: string,
  obniz_id: string | number,
  deviceRoom: Room,
  callback: (error: null | Error, obniz: any) => void
) {
  // 再接続すぐのもの？
  if (deviceRoom) {
    logger.debug(`fast load for obniz ${obniz_id}`);
    callback(null, deviceRoom.obniz);
  } else {
    // get obniz info from obniz cloud
    ObnizCloudAPI.getObnizInfo(wsroom_id, obniz_id, callback);
  }
}

export function isClientWsRequest(requestUrl: URL): boolean {
  const paths = requestUrl.pathname.split('/');
  return (
    paths.length === 5 &&
    paths[1] === 'obniz' &&
    paths[3] === 'ws' &&
    paths[4] === '1'
  );
}

export function isObnizWsRequest(requestUrl: URL): boolean {
  const paths = requestUrl.pathname.split('/');
  return paths.length === 4 && paths[1] === 'endpoints' && paths[3] === 'ws';
}

export function parseObnizId(requestUrl: URL): number | null {
  const paths = requestUrl.pathname.split('/');
  if (paths.length >= 4 && paths[3] === 'ws')
    return viewutil.parse_pretty_id(paths[2]);
  return null;
}
