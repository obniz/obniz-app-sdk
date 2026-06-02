import { DeviceInfo } from '../types/device';

export interface ManagedInstall {
  instanceName: string; // Which Instance handling this
  install: DeviceInfo;
  updatedMillisecond: number;
}

export abstract class InstallStoreBase {
  /**
   * Get an install.
   * @param id obnizId
   */
  public abstract get(id: string): Promise<ManagedInstall | undefined>;

  /**
   * Get all installs specified in the ID array.
   */
  public abstract getMany(
    ids: string[]
  ): Promise<{ [id: string]: ManagedInstall | undefined }>;

  /**
   * Get the Installs on a specific Worker.
   */
  public abstract getByWorker(
    name: string
  ): Promise<{ [id: string]: ManagedInstall }>;

  /**
   * Get all the installs on the InstallStore.
   */
  public abstract getAll(): Promise<{ [id: string]: ManagedInstall }>;

  /**
   * Automatically selects an optimal Slave and creates an Install.
   * @param id obnizId
   */
  public abstract autoCreate(
    id: string,
    deviceInfo: DeviceInfo
  ): Promise<ManagedInstall>;

  /**
   * Automatically assigns many devices to the least-loaded Slaves and creates
   * their Installs in as few round-trips as possible. This is the bulk
   * counterpart of {@link autoCreate} and is used when a large number of new
   * devices appear at once (e.g. initial boot with 1,000+ devices), where
   * creating them one-by-one would be prohibitively slow.
   *
   * Devices that are already installed are skipped. Returns the
   * ManagedInstalls that were actually created.
   * @param devices device list to create
   */
  public abstract bulkCreate(devices: DeviceInfo[]): Promise<ManagedInstall[]>;

  /**
   * Create an Install from the data.
   * @param id obnizId
   * @param install Install Data
   */
  public abstract manualCreate(
    id: string,
    install: ManagedInstall
  ): Promise<ManagedInstall>;

  /**
   * Update the Install data.
   * @param id obnizId
   * @param props Install Data
   */
  public abstract update(
    id: string,
    props: Partial<ManagedInstall>
  ): Promise<ManagedInstall>;

  /**
   * Automatically relocates the Install.
   * @param id obnizId
   */
  public abstract autoRelocate(
    id: string,
    force?: boolean
  ): Promise<ManagedInstall>;

  /**
   * Remove Install.
   * @param id obnizId
   */
  public abstract remove(id: string): Promise<void>;
}
