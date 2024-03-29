import { IObniz } from './Obniz.interface';
import { Adaptor } from './adaptor/Adaptor';
import { Worker } from './Worker';
import { Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';
import { logger } from './logger';
import { App } from './App';
import { RedisAdaptor } from './adaptor/RedisAdaptor';
import { ManagedInstall } from './install_store/InstallStoreBase';
import { deepEqual } from 'fast-equals';
import { MessageBodies } from './utils/message';

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
    this._adaptor.onSynchronize = async (
      options: MessageBodies['synchronize']
    ) => {
      await this._synchronize(options);
    };

    this._adaptor.onReportRequest = async (masterName: string) => {
      await this._reportToMaster(masterName);
    };

    this._adaptor.onKeyRequest = async (
      masterName: string,
      requestId: string,
      key: string,
      obnizId?: string
    ) => {
      await this._keyRequestProcess(masterName, requestId, key, obnizId);
    };
  }

  protected async _keyRequestProcess(
    masterName: string,
    requestId: string,
    key: string,
    obnizId?: string
  ): Promise<void> {
    if (obnizId !== undefined && this._workers[obnizId] === undefined) {
      await this._adaptor.keyRequestResponse(masterName, requestId, {});
      return;
    }
    const targetWorkers =
      obnizId === undefined
        ? this._workers
        : { [obnizId]: this._workers[obnizId] };
    const results: { [key: string]: string } = {};
    for (const install_id in targetWorkers) {
      results[install_id] = await this._workers[install_id].onRequest(key);
    }
    await this._adaptor.keyRequestResponse(masterName, requestId, results);
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
        installs[obnizId] = (
          JSON.parse(rawInstalls[obnizId]) as ManagedInstall
        ).install;
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
    options: MessageBodies['synchronize']
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

    const copyDevice = { ...oldWorker?.install, deviceLiveInfo: {} };
    const copyInstall = { ...install, deviceLiveInfo: {} };
    if (oldWorker && !deepEqual(copyDevice, copyInstall)) {
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

  protected async _onHeartBeat(): Promise<void> {
    if (this._adaptor instanceof RedisAdaptor) {
      await this._adaptor.onSlaveHeartbeat();
    } else {
      await this._reportToMaster();
    }
  }

  /**
   * Let Master know worker is working.
   */
  protected async _reportToMaster(masterName?: string): Promise<void> {
    const keys = Object.keys(this._workers);
    await this._adaptor.report(keys, masterName);
  }

  public startSyncing(): void {
    // every minutes
    if (!this._interval) {
      this._interval = setInterval(async () => {
        try {
          await this._onHeartBeat();
        } catch (e) {
          logger.error(e);
        }
      }, 10 * 1000);
      this._onHeartBeat()
        .then()
        .catch((e) => {
          logger.error(e);
        });
    }
  }

  public async onShutdown() {
    for (const id in this._workers) {
      await this._stopOneWorker(id);
    }
    if (this._interval) clearTimeout(this._interval);
    await this._adaptor.shutdown();
  }
}
