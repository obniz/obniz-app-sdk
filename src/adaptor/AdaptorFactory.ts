import { Adaptor } from './Adaptor';

import { RedisAdaptor, RedisAdaptorOptions } from './RedisAdaptor';
import { MemoryAdaptor, MemoryAdaptorOptions } from './MemoryAdaptor';
import { MqttAdaptor } from './MqttAdaptor';

export interface DatabaseConfig {
  redis: RedisAdaptorOptions;
  memory: MemoryAdaptorOptions;
  mqtt: string;
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
    } else if (database === 'mqtt') {
      return new MqttAdaptor(id, isMaster, option as DatabaseConfig['mqtt']);
    }

    throw new Error('unknown database type : ' + database);
  }
}
