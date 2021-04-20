import express from 'express';
export interface AuthMiddlewareOption {
    tokenType?: 'cookie';
    tokenKeyName?: 'token';
    addUserObjectToRequest?: boolean;
}
export declare function authMiddleware(option?: AuthMiddlewareOption): (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>;
