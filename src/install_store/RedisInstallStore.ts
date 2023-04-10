import { RedisAdaptor } from '../adaptor/RedisAdaptor';
import { logger } from '../logger';
import { DeviceInfo } from '../types/device';
import { InstallStoreBase, ManagedInstall } from './InstallStoreBase';

const AutoCreateLuaScript = `redis.replicate_commands()local a=redis.call('KEYS','slave:*:heartbeat')local b=redis.call('KEYS','workers:*')if#a==0 then return{err='NO_ACCEPTABLE_WORKER'}end;for c=1,#b do local d=redis.call('HEXISTS',b[c],KEYS[1])if d==1 then return{err='ALREADY_INSTALLED'}end end;local e;local f;for c=1,#a do local g=string.match(a[c],"slave:(.+):heartbeat")local h=redis.call('HLEN','workers:'..g)if f==nil or f>=h then e=g;f=h end end;local i=cjson.decode(ARGV[1])local j=redis.call('TIME')local k=j[1]i['instanceName']=e;i['updatedMillisecond']=k;local l=cjson.encode(i)local m=redis.call('HSET','workers:'..e,KEYS[1],l)local n=redis.call('HGET','workers:'..e,KEYS[1])return{n}`;

const AutoRelocateLuaScript = `redis.replicate_commands()local a=redis.call('KEYS','slave:*:heartbeat')local b=redis.call('KEYS','workers:*')if#a==0 then return{err='NO_ACCEPTABLE_WORKER'}end;local c;for d=1,#b do local e=redis.call('HEXISTS',b[d],KEYS[1])if e==1 then c=string.match(b[d],"workers:(.+)")break end end;if c==nil then return{err='NOT_INSTALLED'}end;if ARGV[1]=='false'then local f=redis.call('EXISTS','slave:'..c..':heartbeat')if not(f==0)then return{err='NO_NEED_TO_RELOCATE'}end end;local g;local h;for d=1,#a do local i=string.match(a[d],"slave:(.+):heartbeat")if not(i==c)then local j=redis.call('HLEN','workers:'..i)if h==nil or h>=j then g=i;h=j end end end;if g==nil then return{err='NO_OTHER_ACCEPTABLE_WORKER'}end;local k=cjson.decode(redis.call('HGET','workers:'..c,KEYS[1]))local l=k;local m=redis.call('TIME')local n=m[1]l['instanceName']=g;l['updatedMillisecond']=n;local o=cjson.encode(l)local p=redis.call('HSET','workers:'..g,KEYS[1],o)local q=redis.call('HGET','workers:'..g,KEYS[1])local r=redis.call('HDEL','workers:'..c,KEYS[1])return{q}`;

const UpdateInstallLuaScript = `redis.replicate_commands()local a=redis.call('KEYS','slave:*:heartbeat')local b=redis.call('KEYS','workers:*')if#a==0 then return{err='NO_RUNNING_WORKER'}end;local c;for d=1,#b do local e=redis.call('HEXISTS',b[d],KEYS[1])if e==1 then c=string.match(b[d],"workers:(.+)")break end end;if c==nil then return{err='NOT_INSTALLED'}end;local f=cjson.decode(redis.call('HGET','workers:'..c,KEYS[1]))local g=cjson.decode(ARGV[1])local h=f;for i,j in pairs(g)do h[i]=j end;local k=cjson.encode(h)local l=redis.call('HSET','workers:'..c,KEYS[1],k)local m=redis.call('HGET','workers:'..c,KEYS[1])return{m}`;

const AllRelocateLuaScript = `local function a(b,c)for d=1,#b do if b[d]==c then return true end end;return false end;redis.replicate_commands()local e=redis.call('KEYS','slave:*:heartbeat')local f=redis.call('KEYS','workers:*')if#e==0 then return{err='NO_WORKER'}end;local g={}local h=0;for d=1,#e do local c=string.match(e[d],"slave:(.+):heartbeat")if a(f,'workers:'..c)then local i=redis.call('HLEN','workers:'..c)table.insert(g,{key=c,count=i})h=h+i else table.insert(g,{key=c,count=0})end end;local j=math.floor(h/#g)for k=1,#g do table.sort(g,function(l,m)return l.count>m.count end)local n=g[1]local o=g[#g]if o.count==j then break end;local p=math.min(math.floor((n.count-o.count)/2),j)local q=redis.call('HGETALL','workers:'..n.key)for d=1,p*2,2 do local r=cjson.decode(q[d+1])local s=r;local t=redis.call('TIME')[1]s['instanceName']=o.key;s['updatedMillisecond']=t;local u=cjson.encode(s)local v=redis.call('HSET','workers:'..o.key,q[d],u)local w=redis.call('HDEL','workers:'..n.key,q[d])end;g[1]={key=g[1].key,count=g[1].count-p}g[#g]={key=g[#g].key,count=g[#g].count+p}end`;

export class RedisInstallStore extends InstallStoreBase {
  private _redisAdaptor: RedisAdaptor;

  constructor(adaptor: RedisAdaptor) {
    super();
    this._redisAdaptor = adaptor;
  }

  public async get(id: string): Promise<ManagedInstall | undefined> {
    const redis = this._redisAdaptor.getRedisInstance();
    const workerKeys = await redis.keys('workers:*');
    let install: ManagedInstall | undefined;
    for await (const key of workerKeys) {
      const ins = await redis.hget(key, id);
      if (ins) install = JSON.parse(ins) as ManagedInstall;
    }
    return install;
  }

  public async getMany(
    ids: string[]
  ): Promise<{ [id: string]: ManagedInstall | undefined }> {
    const redis = this._redisAdaptor.getRedisInstance();
    const workerKeys = await redis.keys('workers:*');
    const installs: { [id: string]: ManagedInstall | undefined } = {};
    for (const id of ids) {
      for await (const key of workerKeys) {
        const ins = await redis.hget(key, id);
        if (ins) installs[id] = JSON.parse(ins) as ManagedInstall;
      }
    }
    return installs;
  }

  public async getByWorker(
    name: string
  ): Promise<{ [id: string]: ManagedInstall }> {
    const redis = this._redisAdaptor.getRedisInstance();
    const rawInstalls = await redis.hgetall(`workers:${name}`);
    const installs: { [id: string]: ManagedInstall } = {};
    for (const obnizId in rawInstalls) {
      installs[obnizId] = JSON.parse(rawInstalls[obnizId]) as ManagedInstall;
    }
    return installs;
  }

  public async getAll(): Promise<{ [id: string]: ManagedInstall }> {
    const redis = this._redisAdaptor.getRedisInstance();
    // Search where
    const workerKeys = await redis.keys('workers:*');
    const installs: { [id: string]: ManagedInstall } = {};
    for await (const key of workerKeys) {
      const workerNameMatch = key.match(/workers:(?<name>.+)/);
      if (
        workerNameMatch === null ||
        workerNameMatch.groups?.name === undefined
      )
        continue;
      const workerName = workerNameMatch.groups.name;
      const workers = await this.getByWorker(workerName);
      Object.assign(installs, workers);
    }
    return installs;
  }

  public async autoCreate(
    id: string,
    deviceInfo: DeviceInfo
  ): Promise<ManagedInstall> {
    const redis = this._redisAdaptor.getRedisInstance();
    try {
      const res = await redis.eval(
        AutoCreateLuaScript,
        1,
        id,
        JSON.stringify({ deviceInfo })
      );
      return JSON.parse(res as string) as ManagedInstall;
    } catch (e) {
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

  public async manualCreate(
    id: string,
    install: ManagedInstall
  ): Promise<ManagedInstall> {
    const redis = this._redisAdaptor.getRedisInstance();
    // setnx
    const resSetNx = await redis.hsetnx(
      `workers:${install.instanceName}`,
      id,
      JSON.stringify(install)
    );
    if (resSetNx === 1) {
      // Created
      return install;
    } else {
      // Already created
      throw new Error(`${id} already created`);
    }
  }

  public async autoRelocate(
    id: string,
    force = false
  ): Promise<ManagedInstall> {
    const redis = this._redisAdaptor.getRedisInstance();
    try {
      const res = await redis.eval(
        AutoRelocateLuaScript,
        1,
        id,
        force ? 'true' : 'false'
      );
      return JSON.parse(res as string) as ManagedInstall;
    } catch (e) {
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

  public async update(
    id: string,
    props: Partial<ManagedInstall>
  ): Promise<ManagedInstall> {
    const redis = this._redisAdaptor.getRedisInstance();
    try {
      const res = await redis.eval(
        UpdateInstallLuaScript,
        1,
        id,
        JSON.stringify(props)
      );
      return JSON.parse(res as string) as ManagedInstall;
    } catch (e) {
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

  public async remove(id: string): Promise<void> {
    const install = await this.get(id);
    if (install) {
      const redis = this._redisAdaptor.getRedisInstance();
      const res = await redis.hdel(`workers:${install.instanceName}`, id);
      if (res !== 1) {
        logger.warn(
          `Invalid data detected (RemoveInstall:${id}) : deleted count is not 1`
        );
      }
    } else {
      logger.warn(`failed remove: ${id} not found`);
    }
  }

  public async doAllRelocate(): Promise<void> {
    const redis = this._redisAdaptor.getRedisInstance();
    try {
      const res = await redis.eval(AllRelocateLuaScript, 0);
    } catch (e) {
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
