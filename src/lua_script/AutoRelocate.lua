-- get slaves
local runningWorkerKeys = redis.call('KEYS', 'slave:*:heartbeat')
local assignedWorkerKeys = redis.call('KEYS', 'workers:*')
if #runningWorkerKeys == 0 then return {err='NO_ACCEPTABLE_WORKER'} end
if #runningWorkerKeys == 1 then return {err='NO_OTHER_ACCEPTABLE_WORKER'} end

-- check obnizId exist
local nowWorkerName
for i = 1 , #assignedWorkerKeys do
  -- note: this will not work on redis cluster
  local exist = redis.call('HEXISTS', assignedWorkerKeys[i], ARGV[1])
  if exist == 1 then
    nowWorkerName = string.match(assignedWorkerKeys[i], "workers:(.+)")
    break
  end
  -- else
    -- table.insert(expectNowKeys, assignedWorkerKeys[i])
end
if nowWorkerName == nil then return {err='NOT_INSTALLED'} end

-- get a less busy worker expect nowWorkerName
local minWorkerName
local minCount
for i = 1 , #runningWorkerKeys do
  local workerName = string.match(runningWorkerKeys[i], "slave:(.+):heartbeat")
  -- expect nowWorkerName
  if not(workerName == nowWorkerName) then
    local count = redis.call('HLEN', 'workers:'..workerName)
    if minCount == nil or minCount >= count then
      minWorkerName = workerName
      minCount = count
    end
  end
end

-- add
local nowObj = cjson.decode(redis.call('HGET', 'workers:'..nowWorkerName, ARGV[1]))
local newObj = nowObj
local timeres = redis.call('TIME')
local timestamp = timeres[1]
newObj['instanceName'] = minWorkerName
newObj['updatedMillisecond'] = timestamp
local json = cjson.encode(newObj)
local setres = redis.call('HSET', 'workers:'..minWorkerName, ARGV[1], json)
local result = redis.call('HGET', 'workers:'..minWorkerName, ARGV[1])
local delres = redis.call('HDEL', 'workers:'..nowWorkerName, ARGV[1])
return { result }