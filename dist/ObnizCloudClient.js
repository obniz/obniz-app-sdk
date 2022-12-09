"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obnizCloudClientInstance = exports.ObnizCloudClient = void 0;
const obniz_cloud_sdk_1 = require("obniz-cloud-sdk");
const limiter_1 = require("limiter");
const limiter = new limiter_1.RateLimiter({
    tokensPerInterval: 10,
    interval: 'second',
});
class ObnizCloudClient {
    async getListFromObnizCloud(token, option) {
        const sdk = (0, obniz_cloud_sdk_1.getSdk)(token, option);
        const allInstalls = [];
        let skip = 0;
        let failCount = 0;
        while (true) {
            try {
                // 流量制限
                await limiter.removeTokens(1);
                const result = await sdk.app({ skip });
                if (!result.app || !result.app.installs) {
                    break;
                }
                for (const edge of result.app.installs.edges) {
                    if (edge) {
                        allInstalls.push(edge.node);
                    }
                }
                if (!result.app.installs.pageInfo.hasNextPage) {
                    break;
                }
                skip += result.app.installs.edges.length;
            }
            catch (e) {
                console.error(e);
                if (++failCount > 10) {
                    throw e;
                }
                await new Promise((resolve) => setTimeout(resolve, failCount * 1000));
            }
        }
        return allInstalls;
    }
    async getDiffListFromObnizCloud(token, option, skip) {
        const sdk = (0, obniz_cloud_sdk_1.getSdk)(token, option);
        const appEvents = [];
        let failCount = 0;
        let maxId = 0;
        while (true) {
            try {
                // 流量制限
                await limiter.removeTokens(1);
                const result = await sdk.appEvents({ skip });
                if (!result.appEvents || !result.appEvents.events) {
                    break;
                }
                for (const edge of result.appEvents.events) {
                    if (edge) {
                        appEvents.push(edge);
                    }
                }
                maxId = Math.max(maxId, ...result.appEvents.events.filter((e) => !!e).map((e) => e.id));
                if (!result.appEvents.pageInfo.hasNextPage) {
                    break;
                }
                skip += result.appEvents.events.length;
            }
            catch (e) {
                console.error(e);
                if (++failCount > 10) {
                    throw e;
                }
                await new Promise((resolve) => setTimeout(resolve, failCount * 1000));
            }
        }
        return { appEvents, maxId };
    }
    async getCurrentEventNo(token, option) {
        var _a;
        const sdk = (0, obniz_cloud_sdk_1.getSdk)(token, option);
        // 流量制限
        await limiter.removeTokens(1);
        const result = await sdk.appEvents({ first: 1 });
        return ((_a = result.appEvents) === null || _a === void 0 ? void 0 : _a.totalCount) || 0;
    }
}
exports.ObnizCloudClient = ObnizCloudClient;
exports.obnizCloudClientInstance = new ObnizCloudClient();
//# sourceMappingURL=ObnizCloudClient.js.map