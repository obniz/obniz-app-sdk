"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptorFactory = void 0;
const RedisAdaptor_1 = require("./RedisAdaptor");
const MemoryAdaptor_1 = require("./MemoryAdaptor");
class AdaptorFactory {
    create(database, id, isMaster, option) {
        if (database === 'memory') {
            return new MemoryAdaptor_1.MemoryAdaptor(id, isMaster, option);
        }
        else if (database === 'redis') {
            return new RedisAdaptor_1.RedisAdaptor(id, isMaster, option);
        }
        throw new Error('unknown database type : ' + database);
    }
}
exports.AdaptorFactory = AdaptorFactory;
//# sourceMappingURL=AdaptorFactory.js.map