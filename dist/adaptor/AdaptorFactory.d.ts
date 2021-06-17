import { Adaptor } from './Adaptor';
import { RedisAdaptorOptions } from './RedisAdaptor';
import { MemoryAdaptorOptions } from './MemoryAdaptor';
export interface DatabaseConfig {
    redis: RedisAdaptorOptions;
    memory: MemoryAdaptorOptions;
}
export declare type Database = keyof DatabaseConfig;
export declare class AdaptorFactory {
    create<T extends Database>(database: T, id: string, isMaster: boolean, option: DatabaseConfig[T]): Adaptor;
}
