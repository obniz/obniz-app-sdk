import { Install, Installed_Device } from "obniz-cloud-sdk/sdk";

export default class Adaptor {

  public onStart?: (install: Installed_Device) => Promise<void>
  public onUpdate?: (install: Installed_Device) => Promise<void>
  public onStop?: (install: Installed_Device) => Promise<void>

  constructor() {

  }

  async start(install: Installed_Device, instanceName: string) {
    await this.onStart!(install);
  }

  async update(install: Installed_Device, instanceName: string) {
    await this.onUpdate!(install);
  }

  async stop(install: Installed_Device, instanceName: string) {
    await this.onStop!(install);
  }
}