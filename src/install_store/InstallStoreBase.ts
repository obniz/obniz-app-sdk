import { Installed_Device as InstalledDevice } from 'obniz-cloud-sdk/sdk';

export enum InstallStatus {
  Starting,
  Started,
  Stopping,
  Stopped,
}

export interface ManagedInstall {
  instanceName: string; // Which Instance handling this
  install: InstalledDevice;
  status: InstallStatus;
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
    device: InstalledDevice
  ): Promise<ManagedInstall>;

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
