import { Installed_Device } from 'obniz-cloud-sdk/sdk';

export type ObnizHardwareIdentifier =
  | 'obnizb1'
  | 'obnizb2'
  | 'm5stickc'
  | 'esp32w'
  | 'esp32p'
  | 'encored'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

export type DeviceInfo = {
  /**
   * obnizId
   * @example "0000-0000"
   */
  id: string;

  /**
   * Hardware Identifier
   */
  hardware: ObnizHardwareIdentifier;

  /**
   * Installed app configuration json
   */
  configs: string;
} & Partial<
  Omit<Installed_Device, 'id' | '__typename' | 'hardware' | 'configs'>
>;
