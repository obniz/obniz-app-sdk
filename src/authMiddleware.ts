import express from 'express';
import { getSdk } from 'obniz-cloud-sdk/index';

export interface AuthMiddlewareOption {
  tokenType?: 'cookie';
  tokenKeyName?: 'token';
  addUserObjectToRequest?: boolean;
}

interface AuthMiddlewareOptionInternal {
  tokenType: 'cookie';
  tokenKeyName: 'token';
  addUserObjectToRequest: boolean;
}

export function authMiddleware(
  option: AuthMiddlewareOption = {}
): (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => void {
  const _option: AuthMiddlewareOptionInternal = {
    tokenType: option.tokenType || 'cookie',
    tokenKeyName: option.tokenKeyName || 'token',
    addUserObjectToRequest: option.addUserObjectToRequest !== false,
  };

  return async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const token = req.cookies[_option.tokenKeyName];
    const obnizAPI = getSdk(token);

    const ret = await obnizAPI.user();
    if (!ret || !ret.user) {
      next(new Error('user not found'));
      return;
    }
    if (_option.addUserObjectToRequest) {
      (req as any).user = ret.user;
    }
  };
}
