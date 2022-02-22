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
  public abstract getAllInstalls(): Promise<{ [id: string]: ManagedInstall }>;

  public abstract createInstall(
    id: string,
    install: ManagedInstall
  ): Promise<ManagedInstall>;

  public abstract updateInstall(
    id: string,
    props: Partial<ManagedInstall>
  ): Promise<ManagedInstall>;

  public abstract removeInstall(id: string): Promise<void>;
}
