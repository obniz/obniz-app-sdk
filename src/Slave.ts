import { IObniz } from './Obniz.interface';
import { Adaptor } from './adaptor/Adaptor';
import { Worker } from './Worker';
import { logger } from './logger';
import { App } from './App';
import { RedisAdaptor } from './adaptor/RedisAdaptor';
import { ManagedInstall } from './install_store/InstallStoreBase';
import { deepEqual } from 'fast-equals';
import { MessageBodies } from './utils/message';
import { DeviceInfo } from './types/device';
import { runWithConcurrency, wait } from './utils/common';
import { ObnizAppTimeoutError } from './Errors';

/**
 * Maximum number of workers booted concurrently during a synchronize. Starting
 * thousands of workers strictly one-by-one is the main reason a Slave is slow
 * to begin working; a bounded fan-out cuts startup latency by orders of
 * magnitude while avoiding a thundering herd of simultaneous obniz connections.
 */
const WORKER_START_CONCURRENCY = 50;

interface WorkerKeyRequestExecute {
  requestId: string;
  isDirect: boolean;
  /**
   * Expected number of Slave instances that will respond. For broadcast
   * requests we resolve as soon as we have received this many responses;
   * 0 means "unknown" and we fall back to timeout-based resolution.
   */
  waitingInstanceCount: number;
  returnedInstanceCount: number;
  results: { [key: string]: string };
  resolve: (
    value: { [key: string]: string } | PromiseLike<{ [key: string]: string }>
  ) => void;
  reject: (reason?: any) => void;
}

export class Slave<O extends IObniz> {
  protected _workers: { [key: string]: Worker<O> } = {};
  protected _interval: ReturnType<typeof setTimeout> | null = null;
  protected _syncing = false;

  private _workerKeyRequestExecutes: {
    [requestId: string]: WorkerKeyRequestExecute;
  } = {};

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

    this._adaptor.onWorkerKeyRequest = async (
      fromInstanceName: string,
      requestId: string,
      key: string,
      obnizId?: string
    ) => {
      await this._workerKeyRequestProcess(
        fromInstanceName,
        requestId,
        key,
        obnizId
      );
    };

    this._adaptor.onWorkerKeyRequestResponse = async (
      requestId: string,
      fromInstanceName: string,
      results: { [key: string]: string }
    ) => {
      const execute = this._workerKeyRequestExecutes[requestId];
      if (!execute) return;
      execute.results = { ...execute.results, ...results };
      execute.returnedInstanceCount++;
      // Direct (by obnizId): resolve on first non-empty response.
      if (execute.isDirect) {
        if (Object.keys(results).length > 0) {
          execute.resolve(execute.results);
          delete this._workerKeyRequestExecutes[requestId];
        }
        return;
      }
      // Broadcast: resolve as soon as every expected Slave has replied,
      // so the caller does not have to wait for the full timeout.
      if (
        execute.waitingInstanceCount > 0 &&
        execute.returnedInstanceCount >= execute.waitingInstanceCount
      ) {
        execute.resolve(execute.results);
        delete this._workerKeyRequestExecutes[requestId];
      }
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
    const results = await this._runOnRequestParallel(targetWorkers, key);
    await this._adaptor.keyRequestResponse(masterName, requestId, results);
  }

  /**
   * Handle a worker-to-worker request from another Slave.
   * For broadcasts (no obnizId): run onRequest on every local worker.
   * For direct requests (obnizId set): only respond if this Slave
   * actually hosts that obnizId — otherwise stay silent, so the
   * requester's direct-mode early-resolve only fires for the real owner.
   */
  protected async _workerKeyRequestProcess(
    fromInstanceName: string,
    requestId: string,
    key: string,
    obnizId?: string
  ): Promise<void> {
    if (obnizId !== undefined) {
      if (this._workers[obnizId] === undefined) {
        // Not our worker; do not respond.
        return;
      }
      const result = await this._workers[obnizId].onRequest(key);
      await this._adaptor.workerKeyRequestResponse(
        fromInstanceName,
        requestId,
        {
          [obnizId]: result,
        }
      );
      return;
    }
    const results = await this._runOnRequestParallel(this._workers, key);
    await this._adaptor.workerKeyRequestResponse(
      fromInstanceName,
      requestId,
      results
    );
  }

  /**
   * Fan out a `key` to every worker in the provided map concurrently and
   * collect their `onRequest` results. Running in parallel avoids the
   * accumulated latency of waiting on each worker sequentially.
   * A worker whose onRequest throws is logged and omitted from results.
   */
  private async _runOnRequestParallel(
    workers: { [id: string]: Worker<O> },
    key: string
  ): Promise<{ [id: string]: string }> {
    const ids = Object.keys(workers);
    const settled = await Promise.all(
      ids.map(async (id) => {
        try {
          return [id, await workers[id].onRequest(key)] as const;
        } catch (e) {
          logger.error(e);
          return [id, undefined] as const;
        }
      })
    );
    const results: { [id: string]: string } = {};
    for (const [id, value] of settled) {
      if (value !== undefined) results[id] = value;
    }
    return results;
  }

  /**
   * Issue a worker-to-worker broadcast request. Returns results collected
   * from all responding Slaves, keyed by obnizId. Resolves as soon as every
   * reachable Slave has replied, or after `timeout` with partial results.
   */
  public async workerRequest(
    key: string,
    timeout = 30 * 1000
  ): Promise<{ [key: string]: string }> {
    // Query how many Slaves should respond so we can early-resolve.
    // 0 means the adaptor can't enumerate peers; in that case we just
    // wait the full timeout.
    const waitingInstanceCount = await this._adaptor.getSlaveInstanceCount();
    return new Promise<{ [key: string]: string }>(async (resolve, reject) => {
      try {
        const requestId = this._generateRequestId();
        this._workerKeyRequestExecutes[requestId] = {
          requestId,
          isDirect: false,
          waitingInstanceCount,
          returnedInstanceCount: 0,
          results: {},
          resolve,
          reject,
        };
        await this._adaptor.workerKeyRequest(key, requestId);
        await wait(timeout);
        const execute = this._workerKeyRequestExecutes[requestId];
        if (execute) {
          delete this._workerKeyRequestExecutes[requestId];
          resolve(execute.results);
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Issue a worker-to-worker direct request targeting a specific obnizId.
   * Resolves on first response from the Slave hosting the obnizId, or
   * rejects with ObnizAppTimeoutError after `timeout` if no response.
   */
  public async workerDirectRequest(
    obnizId: string,
    key: string,
    timeout = 30 * 1000
  ): Promise<{ [key: string]: string }> {
    return new Promise<{ [key: string]: string }>(async (resolve, reject) => {
      try {
        const requestId = this._generateRequestId();
        this._workerKeyRequestExecutes[requestId] = {
          requestId,
          isDirect: true,
          waitingInstanceCount: 0,
          returnedInstanceCount: 0,
          results: {},
          resolve,
          reject,
        };
        await this._adaptor.directWorkerKeyRequest(obnizId, key, requestId);
        await wait(timeout);
        if (this._workerKeyRequestExecutes[requestId]) {
          delete this._workerKeyRequestExecutes[requestId];
          reject(new ObnizAppTimeoutError('Worker request timed out.'));
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  private _generateRequestId(): string {
    return `w-${this._instanceName}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(-8)}`;
  }

  private async _getInstallsFromRedis(): Promise<{
    [id: string]: DeviceInfo;
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
      const installs: { [id: string]: DeviceInfo } = {};
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
      const exists: { [id: string]: Worker<O> } = {};
      for (const install_id in this._workers) {
        exists[install_id] = this._workers[install_id];
      }

      // Anything still in `exists` after this loop is no longer assigned.
      for (const install of installs) {
        if (exists[install.id]) {
          delete exists[install.id];
        }
      }

      // Boot/refresh assigned workers with bounded concurrency instead of
      // sequentially, so a large install list does not serialize startup.
      await runWithConcurrency(
        installs,
        WORKER_START_CONCURRENCY,
        async (install) => {
          try {
            await this._startOrRestartOneWorker(install);
          } catch (e) {
            logger.error(e);
          }
        }
      );

      // Apps which are not listed anymore. _stopOneWorker stops in the
      // background, so these can be kicked off together.
      await Promise.all(
        Object.keys(exists).map((install_id) => this._stopOneWorker(install_id))
      );
    } catch (e) {
      logger.error(e);
    }

    this._syncing = false;
  }

  protected async _startOneWorker(deviceInfo: DeviceInfo): Promise<void> {
    logger.info(`New Worker Start id=${deviceInfo.id}`);

    const wclass = this._app._options.workerClassFunction(deviceInfo);
    const worker = new wclass(deviceInfo, this._app, this, {
      ...this._app._options.obnizOption,
      access_token: this._app._options.appToken,
    });

    this._workers[deviceInfo.id] = worker;
    await worker.start();
  }

  protected async _startOrRestartOneWorker(
    deviceInfo: DeviceInfo
  ): Promise<void> {
    const oldWorker = this._workers[deviceInfo.id];

    const copyDevice = { ...oldWorker?.deviceInfo, deviceLiveInfo: {} };
    const copyInstall = { ...deviceInfo, deviceLiveInfo: {} };
    if (oldWorker && !deepEqual(copyDevice, copyInstall)) {
      logger.info(`App config changed id=${deviceInfo.id}`);
      await this._stopOneWorker(deviceInfo.id);
      await this._startOneWorker(deviceInfo);
    } else if (!oldWorker) {
      await this._startOneWorker(deviceInfo);
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
        .then(() => this._bootstrapFromRedis())
        .catch((e) => {
          logger.error(e);
        });
    }
  }

  /**
   * On startup, immediately restore this Slave's previously-assigned workers
   * by reading its assignments straight from Redis, rather than waiting for
   * the Manager's next periodic synchronize broadcast (up to 60s away). This
   * is what makes a restarted Slave resume past work quickly. The heartbeat is
   * written first (in startSyncing) so the Manager can already see this Slave.
   *
   * No-op for non-Redis adaptors, where assignments are pushed by the Manager.
   */
  private async _bootstrapFromRedis(): Promise<void> {
    if (!(this._adaptor instanceof RedisAdaptor)) return;
    try {
      await this._synchronize({ syncType: 'redis' });
    } catch (e) {
      logger.error(e);
    }
  }

  public async onShutdown() {
    for (const id in this._workers) {
      await this._stopOneWorker(id);
    }
    if (this._interval) clearTimeout(this._interval);
    await this._adaptor.shutdown();
  }

  public async restartWorker(obnizId: string) {
    const worker = this._workers[obnizId];
    if (worker === undefined) {
      logger.error(`Not found specified worker id=${obnizId}`);
      return false;
    }
    await this._stopOneWorker(obnizId);
    await this._startOneWorker(worker.deviceInfo);
    logger.info(`App restarted id=${obnizId}`);
    return true;
  }
}
