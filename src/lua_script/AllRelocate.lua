-- search
local function hasKey(keys, key)
  for i = 1, #keys do
    if (keys[i] == key) then return true end
  end
  return false
end

-- for debug
local function tabledbg (keys)
  for k, v in ipairs(keys) do
    redis.log(redis.LOG_WARNING, cjson.encode(v))
  end
end

-- get workers
local runningWorkerKeys = redis.call('KEYS', 'slave:*:heartbeat')
local assignedWorkerKeys = redis.call('KEYS', 'workers:*');
if #runningWorkerKeys == 0 then return {err='NO_WORKER'} end

-- worker counter
local assignedCounts = {}
local totalCount = 0
for i = 1, #runningWorkerKeys do
  local key = string.match(runningWorkerKeys[i], "slave:(.+):heartbeat")
  if hasKey(assignedWorkerKeys, 'workers:'..key) then
    local count = redis.call('HLEN', 'workers:'..key)
    table.insert(assignedCounts, {key=key,count=count})
    totalCount = totalCount + count
  else
    table.insert(assignedCounts, {key=key,count=0})
  end
end

-- determine end cond
local minCountCond = math.floor(totalCount / #assignedCounts)
-- redis.log(redis.LOG_WARNING, 'minCountCond is '..minCountCond)
-- redis.log(redis.LOG_WARNING, 'max try count is '..math.ceil(#assignedCounts / 2))

for j = 1, math.ceil(#assignedCounts / 2) do

  table.sort(assignedCounts, function (a, b)
    return a.count > b.count
  end)

  -- tabledbg(assignedCounts)

  local max = assignedCounts[1]
  local min = assignedCounts[#assignedCounts]

  if min.count == minCountCond then break end

  local movCount = math.min(math.floor((max.count - min.count) / 2), minCountCond)
  -- redis.log(redis.LOG_WARNING, 'move: '..max.key..' => '..min.key..' x '..movCount)

  local movWorkers = redis.call('HSCAN', 'workers:'..max.key, 0, 'MATCH', '*', 'COUNT', movCount)[2]
  for i = 1, movCount * 2, 2 do
    -- redis.log(redis.LOG_WARNING, 'moving: '..max.key..' => '..min.key..' '..((i+1)/2)..'/'..movCount)
    local nowObj = cjson.decode(movWorkers[i + 1])
    local newObj = nowObj
    local timestamp = redis.call('TIME')[1]
    newObj['instanceName'] = min.key
    newObj['updatedMillisecond'] = timestamp
    local json = cjson.encode(newObj)
    local setres = redis.call('HSET', 'workers:'..min.key, movWorkers[i], json)
    local delres = redis.call('HDEL', 'workers:'..max.key, movWorkers[i])
    -- redis.log(redis.LOG_WARNING, 'done!')
  end
  assignedCounts[1] = {key=assignedCounts[1].key, count=assignedCounts[1].count - movCount}
  assignedCounts[#assignedCounts] = {key=assignedCounts[#assignedCounts].key, count=assignedCounts[#assignedCounts].count + movCount}
end

-- redis.log(redis.LOG_WARNING, 'all done!')
-- tabledbg(assignedCounts)