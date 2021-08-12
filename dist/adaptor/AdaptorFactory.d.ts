import { Adaptor } from './Adaptor';
import { RedisAdaptorOptions } from './RedisAdaptor';
import { MemoryAdaptorOptions } from './MemoryAdaptor';
import { MqttAdaptorOptions } from './MqttAdaptor';
export interface DatabaseConfig {
    redis: RedisAdaptorOptions;
    memory: MemoryAdaptorOptions;
    mqtt: MqttAdaptorOptions;
}
export declare type Database = keyof DatabaseConfig;
export declare class AdaptorFactory {
    create<T extends Database>(database: T, id: string, isMaster: boolean, option: DatabaseConfig[T]): Adaptor;
}
