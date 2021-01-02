import { Install, Installed_Device } from "obniz-cloud-sdk/sdk";


/**
 * 一方向性のリスト同期
 * Masterからは各Instanceへ分割されたリストを同期
 * Slaveからはping情報の送信のみ
 * Cassandraと同じく「時間が経てば正しくなる」方式を採用。
 */
export default class Adaptor {

  public onReportRequest?: () => Promise<void>
  public onSynchronize?: (installs: Installed_Device[]) => Promise<void>
  public onReported?: (instanceName: string, installIds: string[]) => Promise<void>

  constructor() {

  }

  async synchronize(instanceName: string, installs: Installed_Device[]) {
    this.onSynchronize!(installs);
  }

  async reportRequest() {
    this.onReportRequest!();
  }

  async report(instanceName: string, installIds: string[]) {
    this.onReported!(instanceName, installIds);
  }
}