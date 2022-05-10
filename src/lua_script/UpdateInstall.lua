-- enable commands replication redis < 5.0
redis.replicate_commands()

-- get slaves
local runningWorkerKeys = redis.call('KEYS', 'slave:*:heartbeat')
local assignedWorkerKeys = redis.call('KEYS', 'workers:*')
if #runningWorkerKeys == 0 then return {err='NO_RUNNING_WORKER'} end

-- check obnizId exist
local nowWorkerName
for i = 1 , #assignedWorkerKeys do
  local exist = redis.call('HEXISTS', assignedWorkerKeys[i], KEYS[1])
  if exist == 1 then
    nowWorkerName = string.match(assignedWorkerKeys[i], "workers:(.+)")
    break
  end
end
if nowWorkerName == nil then return {err='NOT_INSTALLED'} end

-- get current
local nowObj = cjson.decode(redis.call('HGET', 'workers:'..nowWorkerName, KEYS[1]))
local overrideObj = cjson.decode(ARGV[1])
local newObj = nowObj
for k,v in pairs(overrideObj) do
  newObj[k] = v
end
local json = cjson.encode(newObj)
local setres = redis.call('HSET', 'workers:'..nowWorkerName, KEYS[1], json)
local result = redis.call('HGET', 'workers:'..nowWorkerName, KEYS[1])
return { result }