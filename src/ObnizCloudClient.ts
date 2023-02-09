import { getSdk, SdkOption } from 'obniz-cloud-sdk';
import { AppEventsQuery, Installed_Device } from 'obniz-cloud-sdk/sdk';
import { RateLimiter } from 'limiter';
import { logger } from './logger';

export type AppEvent = NonNullable<
  NonNullable<AppEventsQuery['appEvents']>['events'][number]
>;

const limiter = new RateLimiter({
  tokensPerInterval: 10, // 10/1secでおこなう
  interval: 'second',
});

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export class ObnizCloudClient {
  async getListFromObnizCloud(
    token: string,
    option: SdkOption
  ): Promise<Installed_Device[]> {
    const sdk = getSdk(token, option);

    const allInstalls: Installed_Device[] = [];
    let skip = 0;
    let failCount = 0;

    logger.debug('Device API sync loop start');

    while (true) {
      const syncStartDate = new Date().valueOf();

      try {
        // 流量制限
        await limiter.removeTokens(1);

        logger.debug(`Device API sync request start. skip=${skip}`);
        const result = await sdk.app({ first: 50, skip });
        logger.debug(
          `Device API sync request end. duration="${
            new Date().valueOf() - syncStartDate
          }ms"`
        );

        if (!result.app || !result.app.installs) {
          break;
        }

        logger.debug(`Number of devices ${result.app.installs.edges.length}`);
        for (const edge of result.app.installs.edges) {
          if (edge) {
            allInstalls.push(edge.node as Installed_Device);
          }
        }

        if (!result.app.installs.pageInfo.hasNextPage) {
          break;
        }

        skip += result.app.installs.edges.length;
      } catch (e) {
        logger.error(
          `Throw device sync error. duration="${
            new Date().valueOf() - syncStartDate
          }ms"`
        );
        console.error(e);

        if (++failCount > 10) {
          throw e;
        }

        await sleep(failCount * 1000);
      }
    }

    logger.debug('Device API sync loop end');

    return allInstalls;
  }

  async getDiffListFromObnizCloud(
    token: string,
    option: SdkOption,
    skip: number
  ): Promise<{ appEvents: AppEvent[]; maxId: number }> {
    const sdk = getSdk(token, option);

    const appEvents: AppEvent[] = [];
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
        maxId = Math.max(
          maxId,
          ...result.appEvents.events.filter((e) => !!e).map((e) => e!.id)
        );

        if (!result.appEvents.pageInfo.hasNextPage) {
          break;
        }
        skip += result.appEvents.events.length;
      } catch (e) {
        console.error(e);
        if (++failCount > 10) {
          throw e;
        }
        await sleep(failCount * 1000);
      }
    }
    return { appEvents, maxId };
  }

  async getCurrentEventNo(token: string, option: SdkOption): Promise<number> {
    const sdk = getSdk(token, option);
    // 流量制限
    await limiter.removeTokens(1);
    const result = await sdk.appEvents({ first: 1 });
    return result.appEvents?.totalCount || 0;
  }
}

export const obnizCloudClientInstance = new ObnizCloudClient();
