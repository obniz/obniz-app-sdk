"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisInstallStore = void 0;
const logger_1 = require("../logger");
const InstallStoreBase_1 = require("./InstallStoreBase");
const AutoCreateLuaScript = `redis.replicate_commands()local a=redis.call('KEYS','slave:*:heartbeat')local b=redis.call('KEYS','workers:*')if#a==0 then return{err='NO_ACCEPTABLE_WORKER'}end;for c=1,#b do local d=redis.call('HEXISTS',b[c],KEYS[1])if d==1 then return{err='ALREADY_INSTALLED'}end end;local e;local f;for c=1,#a do local g=string.match(a[c],"slave:(.+):heartbeat")local h=redis.call('HLEN','workers:'..g)if f==nil or f>=h then e=g;f=h end end;local i=cjson.decode(ARGV[1])local j=redis.call('TIME')local k=j[1]i['instanceName']=e;i['updatedMillisecond']=k;local l=cjson.encode(i)local m=redis.call('HSET','workers:'..e,KEYS[1],l)local n=redis.call('HGET','workers:'..e,KEYS[1])return{n}`;
const AutoRelocateLuaScript = `redis.replicate_commands()local a=redis.call('KEYS','slave:*:heartbeat')local b=redis.call('KEYS','workers:*')if#a==0 then return{err='NO_ACCEPTABLE_WORKER'}end;local c;for d=1,#b do local e=redis.call('HEXISTS',b[d],KEYS[1])if e==1 then c=string.match(b[d],"workers:(.+)")break end end;if c==nil then return{err='NOT_INSTALLED'}end;if ARGV[1]=='false'then local f=redis.call('EXISTS','slave:'..c..':heartbeat')if not(f==0)then return{err='NO_NEED_TO_RELOCATE'}end end;local g;local h;for d=1,#a do local i=string.match(a[d],"slave:(.+):heartbeat")if not(i==c)then local j=redis.call('HLEN','workers:'..i)if h==nil or h>=j then g=i;h=j end end end;if g==nil then return{err='NO_OTHER_ACCEPTABLE_WORKER'}end;local k=cjson.decode(redis.call('HGET','workers:'..c,KEYS[1]))local l=k;local m=redis.call('TIME')local n=m[1]l['instanceName']=g;l['updatedMillisecond']=n;local o=cjson.encode(l)local p=redis.call('HSET','workers:'..g,KEYS[1],o)local q=redis.call('HGET','workers:'..g,KEYS[1])local r=redis.call('HDEL','workers:'..c,KEYS[1])return{q}`;
const UpdateInstallLuaScript = `redis.replicate_commands()local a=redis.call('KEYS','slave:*:heartbeat')local b=redis.call('KEYS','workers:*')if#a==0 then return{err='NO_RUNNING_WORKER'}end;local c;for d=1,#b do local e=redis.call('HEXISTS',b[d],KEYS[1])if e==1 then c=string.match(b[d],"workers:(.+)")break end end;if c==nil then return{err='NOT_INSTALLED'}end;local f=cjson.decode(redis.call('HGET','workers:'..c,KEYS[1]))local g=cjson.decode(ARGV[1])local h=f;for i,j in pairs(g)do h[i]=j end;local k=cjson.encode(h)local l=redis.call('HSET','workers:'..c,KEYS[1],k)local m=redis.call('HGET','workers:'..c,KEYS[1])return{m}`;
const AllRelocateLuaScript = `local function a(b,c)for d=1,#b do if b[d]==c then return true end end;return false end;redis.replicate_commands()local e=redis.call('KEYS','slave:*:heartbeat')local f=redis.call('KEYS','workers:*')if#e==0 then return{err='NO_WORKER'}end;local g={}local h=0;for d=1,#e do local c=string.match(e[d],"slave:(.+):heartbeat")if a(f,'workers:'..c)then local i=redis.call('HLEN','workers:'..c)table.insert(g,{key=c,count=i})h=h+i else table.insert(g,{key=c,count=0})end end;local j=math.floor(h/#g)for k=1,#g do table.sort(g,function(l,m)return l.count>m.count end)local n=g[1]local o=g[#g]if o.count==j then break end;local p=math.min(math.floor((n.count-o.count)/2),j)local q=redis.call('HGETALL','workers:'..n.key)for d=1,p*2,2 do local r=cjson.decode(q[d+1])local s=r;local t=redis.call('TIME')[1]s['instanceName']=o.key;s['updatedMillisecond']=t;local u=cjson.encode(s)local v=redis.call('HSET','workers:'..o.key,q[d],u)local w=redis.call('HDEL','workers:'..n.key,q[d])end;g[1]={key=g[1].key,count=g[1].count-p}g[#g]={key=g[#g].key,count=g[#g].count+p}end`;
class RedisInstallStore extends InstallStoreBase_1.InstallStoreBase {
    constructor(adaptor) {
        super();
        this._redisAdaptor = adaptor;
    }
    async get(id) {
        var _a, e_1, _b, _c;
        const redis = this._redisAdaptor.getRedisInstance();
        const workerKeys = await redis.keys('workers:*');
        let install;
        try {
            for (var _d = true, workerKeys_1 = __asyncValues(workerKeys), workerKeys_1_1; workerKeys_1_1 = await workerKeys_1.next(), _a = workerKeys_1_1.done, !_a;) {
                _c = workerKeys_1_1.value;
                _d = false;
                try {
                    const key = _c;
                    const ins = await redis.hget(key, id);
                    if (ins)
                        install = JSON.parse(ins);
                }
                finally {
                    _d = true;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = workerKeys_1.return)) await _b.call(workerKeys_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return install;
    }
    async getMany(ids) {
        var _a, e_2, _b, _c;
        const redis = this._redisAdaptor.getRedisInstance();
        const workerKeys = await redis.keys('workers:*');
        const installs = {};
        for (const id of ids) {
            try {
                for (var _d = true, workerKeys_2 = (e_2 = void 0, __asyncValues(workerKeys)), workerKeys_2_1; workerKeys_2_1 = await workerKeys_2.next(), _a = workerKeys_2_1.done, !_a;) {
                    _c = workerKeys_2_1.value;
                    _d = false;
                    try {
                        const key = _c;
                        const ins = await redis.hget(key, id);
                        if (ins)
                            installs[id] = JSON.parse(ins);
                    }
                    finally {
                        _d = true;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = workerKeys_2.return)) await _b.call(workerKeys_2);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        return installs;
    }
    async getByWorker(name) {
        const redis = this._redisAdaptor.getRedisInstance();
        const rawInstalls = await redis.hgetall(`workers:${name}`);
        const installs = {};
        for (const obnizId in rawInstalls) {
            installs[obnizId] = JSON.parse(rawInstalls[obnizId]);
        }
        return installs;
    }
    async getAll() {
        var _a, e_3, _b, _c;
        var _d;
        const redis = this._redisAdaptor.getRedisInstance();
        // Search where
        const workerKeys = await redis.keys('workers:*');
        const installs = {};
        try {
            for (var _e = true, workerKeys_3 = __asyncValues(workerKeys), workerKeys_3_1; workerKeys_3_1 = await workerKeys_3.next(), _a = workerKeys_3_1.done, !_a;) {
                _c = workerKeys_3_1.value;
                _e = false;
                try {
                    const key = _c;
                    const workerNameMatch = key.match(/workers:(?<name>.+)/);
                    if (workerNameMatch === null ||
                        ((_d = workerNameMatch.groups) === null || _d === void 0 ? void 0 : _d.name) === undefined)
                        continue;
                    const workerName = workerNameMatch.groups.name;
                    const workers = await this.getByWorker(workerName);
                    Object.assign(installs, workers);
                }
                finally {
                    _e = true;
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (!_e && !_a && (_b = workerKeys_3.return)) await _b.call(workerKeys_3);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return installs;
    }
    async autoCreate(id, device) {
        const redis = this._redisAdaptor.getRedisInstance();
        try {
            const res = await redis.eval(AutoCreateLuaScript, 1, id, JSON.stringify({ install: device }));
            return JSON.parse(res);
        }
        catch (e) {
            if (e instanceof Error) {
                switch (e.message) {
                    case 'NO_ACCEPTABLE_WORKER':
                    case 'ALREADY_INSTALLED':
                        throw new Error(e.message);
                    default:
                        throw e;
                }
            }
            throw e;
        }
    }
    async manualCreate(id, install) {
        const redis = this._redisAdaptor.getRedisInstance();
        // setnx
        const resSetNx = await redis.hsetnx(`workers:${install.instanceName}`, id, JSON.stringify(install));
        if (resSetNx === 1) {
            // Created
            return install;
        }
        else {
            // Already created
            throw new Error(`${id} already created`);
        }
    }
    async autoRelocate(id, force = false) {
        const redis = this._redisAdaptor.getRedisInstance();
        try {
            const res = await redis.eval(AutoRelocateLuaScript, 1, id, force ? 'true' : 'false');
            return JSON.parse(res);
        }
        catch (e) {
            if (e instanceof Error) {
                switch (e.message) {
                    case 'NO_ACCEPTABLE_WORKER':
                    case 'NOT_INSTALLED':
                    case 'NO_OTHER_ACCEPTABLE_WORKER':
                    case 'NO_NEED_TO_RELOCATE':
                        throw new Error(e.message);
                    default:
                        throw e;
                }
            }
            throw e;
        }
    }
    async update(id, props) {
        const redis = this._redisAdaptor.getRedisInstance();
        try {
            const res = await redis.eval(UpdateInstallLuaScript, 1, id, JSON.stringify(props));
            return JSON.parse(res);
        }
        catch (e) {
            if (e instanceof Error) {
                switch (e.message) {
                    case 'NO_RUNNING_WORKER':
                    case 'NOT_INSTALLED':
                        throw new Error(e.message);
                    default:
                        throw e;
                }
            }
            throw e;
        }
    }
    async remove(id) {
        const install = await this.get(id);
        if (install) {
            const redis = this._redisAdaptor.getRedisInstance();
            const res = await redis.hdel(`workers:${install.instanceName}`, id);
            if (res !== 1) {
                logger_1.logger.warn(`Invalid data detected (RemoveInstall:${id}) : deleted count is not 1`);
            }
        }
        else {
            logger_1.logger.warn(`failed remove: ${id} not found`);
        }
    }
    async doAllRelocate() {
        const redis = this._redisAdaptor.getRedisInstance();
        try {
            const res = await redis.eval(AllRelocateLuaScript, 0);
        }
        catch (e) {
            if (e instanceof Error) {
                switch (e.message) {
                    case 'NO_WORKER':
                        throw new Error(e.message);
                    default:
                        throw e;
                }
            }
            throw e;
        }
    }
}
exports.RedisInstallStore = RedisInstallStore;
//# sourceMappingURL=RedisInstallStore.js.map