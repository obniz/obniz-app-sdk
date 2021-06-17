import { Adaptor } from './Adaptor';

import { RedisAdaptor, RedisAdaptorOptions } from './RedisAdaptor';
import { MemoryAdaptor, MemoryAdaptorOptions } from './MemoryAdaptor';

export interface DatabaseConfig {
  redis: RedisAdaptorOptions;
  memory: MemoryAdaptorOptions;
}

export type Database = keyof DatabaseConfig;

export class AdaptorFactory {
  create<T extends Database>(
    database: T,
    id: string,
    isMaster: boolean,
    option: DatabaseConfig[T]
  ): Adaptor {
    if (database === 'memory') {
      return new MemoryAdaptor(
        id,
        isMaster,
        option as DatabaseConfig['memory']
      );
    } else if (database === 'redis') {
      return new RedisAdaptor(id, isMaster, option as DatabaseConfig['redis']);
    }

    throw new Error('unknown database type : ' + database);
  }
}
