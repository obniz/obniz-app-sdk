import { getSdk } from 'obniz-cloud-sdk';
import { Installed_Device } from 'obniz-cloud-sdk/sdk';

// TODO: !を使ってるのを治す
export async function getInstallRequest(token: string) {
  const sdk = getSdk(token);
  const allInstalls: Installed_Device[] = [];
  let skip = 0;
  let failCount = 0;
  while (true) {
    try {
      const result = await sdk.app({ skip });
      for (const edge of result.app!.installs!.edges) {
        allInstalls.push(edge!.node as Installed_Device);
      }
      if (!result.app!.installs!.pageInfo.hasNextPage) {
        break;
      }
      skip += result.app!.installs!.edges.length;
    } catch (e) {
      console.error(e);
      if (++failCount > 10) {
        throw e;
      }
      await new Promise((resolve) => setTimeout(resolve, failCount * 1000));
    }
  }
  return allInstalls;
}
