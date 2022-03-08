import { IObniz } from './Obniz.interface';
import { Adaptor, SynchronizeMethodOption } from './adaptor/Adaptor';
import { Worker } from './Worker';
import { Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';
import { logger } from './logger';
import { App } from './App';
import { RedisAdaptor } from './adaptor/RedisAdaptor';
import { ManagedInstall } from './install_store/InstallStoreBase';

export class Slave<O extends IObniz> {
  protected _workers: { [key: string]: Worker<O> } = {};
  protected _interval: ReturnType<typeof setTimeout> | null = null;
  protected _syncing = false;

  constructor(
    protected readonly _adaptor: Adaptor,
    protected readonly _instanceName: string,
    protected readonly _app: App<O>
  ) {
    this.bindAdaptorCallbacks(_adaptor);
  }

  private bindAdaptorCallbacks(adaptor: Adaptor) {
    adaptor.onRequestRequested = async (
      key: string
    ): Promise<{ [key: string]: string }> => {
      const results: { [key: string]: string } = {};
      for (const install_id in this._workers) {
        results[install_id] = await this._workers[install_id].onRequest(key);
      }
      return results;
    };

    this._adaptor.onSynchronize = async (options: SynchronizeMethodOption) => {
      await this._synchronize(options);
    };

    this._adaptor.onReportRequest = async () => {
      await this._reportToMaster();
    };

    this._adaptor.onKeyRequest = async (requestId: string, key: string) => {
      await this._keyRequestProcess(requestId, key);
    };
  }

  protected async _keyRequestProcess(
    requestId: string,
    key: string
  ): Promise<void> {
    const results: { [key: string]: string } = {};
    for (const install_id in this._workers) {
      results[install_id] = await this._workers[install_id].onRequest(key);
    }
    await this._adaptor.keyRequestResponse(
      requestId,
      this._instanceName,
      results
    );
  }

  private async _getInstallsFromRedis(): Promise<{
    [id: string]: InstalledDevice;
  }> {
    if (!(this._adaptor instanceof RedisAdaptor)) {
      throw new Error(
        'Cannot fetch installs from Redis because the instance is not connected to Redis.'
      );
    }
    try {
      const redis = this._adaptor.getRedisInstance();
      const rawInstalls = await redis.hgetall(
        `workers:${this._app._options.instanceName}`
      );
      const installs: { [id: string]: InstalledDevice } = {};
      for (const obnizId in rawInstalls) {
        installs[obnizId] = (JSON.parse(
          rawInstalls[obnizId]
        ) as ManagedInstall).install;
      }
      return installs;
    } catch (e) {
      logger.error(e);
    }
    return {};
  }

  /**
   * Receive Master Generated List and compare current apps.
   */
  protected async _synchronize(
    options: SynchronizeMethodOption
  ): Promise<void> {
    if (this._syncing) {
      return;
    }
    this._syncing = true;

    const installs =
      options.syncType === 'list'
        ? options.installs
        : Object.values(await this._getInstallsFromRedis());

    try {
      const exists: any = {};
      for (const install_id in this._workers) {
        exists[install_id] = this._workers[install_id];
      }

      for await (const install of installs) {
        await this._startOrRestartOneWorker(install);
        if (exists[install.id]) {
          delete exists[install.id];
        }
      }

      // Apps which not listed
      for await (const install_id of Object.keys(exists)) {
        await this._stopOneWorker(install_id);
      }
    } catch (e) {
      logger.error(e);
    }

    this._syncing = false;
  }

  protected async _startOneWorker(install: InstalledDevice): Promise<void> {
    logger.info(`New Worker Start id=${install.id}`);

    const wclass = this._app._options.workerClassFunction(install);
    const worker = new wclass(install, this._app, {
      ...this._app._options.obnizOption,
      access_token: this._app._options.appToken,
    });

    this._workers[install.id] = worker;
    await worker.start();
  }

  protected async _startOrRestartOneWorker(
    install: InstalledDevice
  ): Promise<void> {
    const oldWorker = this._workers[install.id];
    if (
      oldWorker &&
      JSON.stringify(oldWorker.install) !== JSON.stringify(install)
    ) {
      logger.info(`App config changed id=${install.id}`);
      await this._stopOneWorker(install.id);
      await this._startOneWorker(install);
    } else if (!oldWorker) {
      await this._startOneWorker(install);
    }
  }

  protected async _stopOneWorker(installId: string): Promise<void> {
    logger.info(`App Deleted id=${installId}`);
    const worker = this._workers[installId];
    if (worker) {
      delete this._workers[installId];

      // background
      worker
        .stop()
        .then(() => {})
        .catch((e) => {
          logger.error(e);
        });
    }
  }

  /**
   * Let Master know worker is working.
   */
  protected async _reportToMaster(): Promise<void> {
    if (this._adaptor instanceof RedisAdaptor) {
      // If adaptor is Redis
      const redis = this._adaptor.getRedisInstance();
      await redis.set(
        `slave:${this._app._options.instanceName}:heartbeat`,
        Date.now(),
        'EX',
        20
      );
    } else {
      const keys = Object.keys(this._workers);
      await this._adaptor.report(this._app._options.instanceName, keys);
    }
  }

  public startSyncing(): void {
    // every minutes
    if (!this._interval) {
      this._interval = setInterval(async () => {
        try {
          await this._reportToMaster();
        } catch (e) {
          logger.error(e);
        }
      }, 10 * 1000);
      this._reportToMaster()
        .then()
        .catch((e) => {
          logger.error(e);
        });
    }
  }
}
