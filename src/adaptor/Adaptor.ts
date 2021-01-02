import { Installed_Device as InstalledDevice} from "obniz-cloud-sdk/sdk";


/**
 * 一方向性のリスト同期
 * Masterからは各Instanceへ分割されたリストを同期
 * Slaveからはping情報の送信のみ
 * Cassandraと同じく「時間が経てば正しくなる」方式を採用。
 */
export class Adaptor {

  public onReportRequest?: () => Promise<void>
  public onSynchronize?: (installs: InstalledDevice[]) => Promise<void>
  public onReported?: (instanceName: string, installIds: string[]) => Promise<void>

  constructor() {

  }

  async synchronize(instanceName: string, installs: InstalledDevice[]) {
    if (this.onSynchronize) {
      await this.onSynchronize(installs);
    }

  }

  async reportRequest() {
    if (this.onReportRequest) {
      await this.onReportRequest();
    }
  }

  async report(instanceName: string, installIds: string[]) {
    if (this.onReported) {
      this.onReported(instanceName, installIds);
    }
  }
}
