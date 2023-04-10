import { DeviceInfo } from './device';

export type FetcherFunction = () => DeviceInfo[] | Promise<DeviceInfo[]>;
