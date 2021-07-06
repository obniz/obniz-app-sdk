"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sharedInstalledDeviceManager = exports.InstalledDeviceManager = void 0;
const obniz_cloud_sdk_1 = require("obniz-cloud-sdk");
class InstalledDeviceManager {
    async getListFromObnizCloud(token, option) {
        const sdk = obniz_cloud_sdk_1.getSdk(token, option);
        const allInstalls = [];
        let skip = 0;
        let failCount = 0;
        while (true) {
            try {
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
}
exports.InstalledDeviceManager = InstalledDeviceManager;
exports.sharedInstalledDeviceManager = new InstalledDeviceManager();
//# sourceMappingURL=install.js.map