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
    const startedAt = new Date().valueOf();

    logger.debug('Device API sync loop start');

    // Fetch the first page to learn the total device count. Once we know the
    // total we can request the remaining pages in parallel windows instead of
    // walking them one-by-one, which is the dominant cost when an App has
    // thousands of installed devices.
    const first = 100;
    const firstPage = await this._fetchInstallPage(sdk, first, 0);
    const allInstalls: Installed_Device[] = [...firstPage.installs];

    const totalCount = firstPage.totalCount;
    if (
      firstPage.hasNextPage &&
      (totalCount === undefined || totalCount > first)
    ) {
      const pageSkips: number[] = [];
      if (totalCount !== undefined) {
        // We know the total: enumerate every remaining page up-front.
        for (let skip = first; skip < totalCount; skip += first) {
          pageSkips.push(skip);
        }
      }

      if (pageSkips.length > 0) {
        // Fetch in concurrent windows. The shared RateLimiter (10/sec) paces
        // the actual requests, so firing them concurrently simply lets the
        // limiter saturate its budget instead of idling between round-trips.
        const windowSize = 10;
        for (let i = 0; i < pageSkips.length; i += windowSize) {
          const window = pageSkips.slice(i, i + windowSize);
          const pages = await Promise.all(
            window.map((skip) => this._fetchInstallPage(sdk, first, skip))
          );
          for (const page of pages) {
            allInstalls.push(...page.installs);
          }
        }
      } else {
        // Total is unknown (older API): fall back to sequential pagination.
        let skip = allInstalls.length;
        let hasNext: boolean = firstPage.hasNextPage;
        while (hasNext) {
          const page = await this._fetchInstallPage(sdk, first, skip);
          allInstalls.push(...page.installs);
          hasNext = page.hasNextPage && page.installs.length > 0;
          skip += page.installs.length;
        }
      }
    }

    logger.debug(
      `Device API sync loop end. count=${allInstalls.length} duration="${
        new Date().valueOf() - startedAt
      }ms"`
    );

    return allInstalls;
  }

  /**
   * Fetch a single page of installed devices with rate-limiting and retry.
   * Returns the page's devices plus pagination metadata.
   */
  private async _fetchInstallPage(
    sdk: ReturnType<typeof getSdk>,
    first: number,
    skip: number
  ): Promise<{
    installs: Installed_Device[];
    hasNextPage: boolean;
    totalCount: number | undefined;
  }> {
    let failCount = 0;
    while (true) {
      const syncStartDate = new Date().valueOf();
      try {
        // 流量制限
        await limiter.removeTokens(1);

        logger.debug(`Device API sync request start. skip=${skip}`);
        const result = await sdk.app({ first, skip });
        logger.debug(
          `Device API sync request end. skip=${skip} duration="${
            new Date().valueOf() - syncStartDate
          }ms"`
        );

        if (!result.app || !result.app.installs) {
          return { installs: [], hasNextPage: false, totalCount: undefined };
        }

        const installs: Installed_Device[] = [];
        for (const edge of result.app.installs.edges) {
          if (edge) {
            installs.push(edge.node as Installed_Device);
          }
        }

        return {
          installs,
          hasNextPage: result.app.installs.pageInfo.hasNextPage,
          totalCount: result.app.installs.totalCount,
        };
      } catch (e) {
        logger.error(
          `Throw device sync error. skip=${skip} duration="${
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
