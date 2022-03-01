-- get slaves
local runningWorkerKeys = redis.call('KEYS', 'slave:*:heartbeat')
local assignedWorkerKeys = redis.call('KEYS', 'workers:*')
if #runningWorkerKeys == 0 then return {err='NO_ACCEPTABLE_WORKER'} end

-- check obnizId not exist
for i = 1 , #assignedWorkerKeys do
  -- note: this will not work on redis cluster
  local exist = redis.call('HEXISTS', assignedWorkerKeys[i], KEYS[1])
  if exist == 1 then return {err='ALREADY_INSTALLED'} end
end

-- get a less busy worker
local minWorkerName
local minCount
for i = 1 , #runningWorkerKeys do
  local workerName = string.match(runningWorkerKeys[i], "slave:(.+):heartbeat")
  local count = redis.call('HLEN', 'workers:'..workerName)
  if minCount == nil or minCount >= count then
    minWorkerName = workerName
    minCount = count
  end
end

-- add
local obj = cjson.decode(ARGV[1])
obj['instanceName'] = minWorkerName
local json = cjson.encode(obj)
local setres = redis.call('HSET', 'workers:'..minWorkerName, KEYS[1], json)
local result = redis.call('HGET', 'workers:'..minWorkerName, KEYS[1])
return { result }