-- enable commands replication redis < 5.0
redis.replicate_commands()

-- get slaves
local runningWorkerKeys = redis.call('KEYS', 'slave:*:heartbeat')
local assignedWorkerKeys = redis.call('KEYS', 'workers:*')
if #runningWorkerKeys == 0 then return {err='NO_ACCEPTABLE_WORKER'} end

-- build running worker name list and current install counts
local names = {}
local counts = {}
for i = 1, #runningWorkerKeys do
  local workerName = string.match(runningWorkerKeys[i], "slave:(.+):heartbeat")
  names[i] = workerName
  counts[i] = redis.call('HLEN', 'workers:'..workerName)
end

local devices = cjson.decode(ARGV[1])
local timeres = redis.call('TIME')
local timestamp = timeres[1]
local results = {}

for d = 1, #devices do
  local id = devices[d].id

  -- skip if obnizId already installed on any worker
  local already = false
  for i = 1, #assignedWorkerKeys do
    if redis.call('HEXISTS', assignedWorkerKeys[i], id) == 1 then
      already = true
      break
    end
  end

  if not already then
    -- pick the currently least-loaded worker (running counts kept in memory)
    local mi = 1
    for c = 2, #counts do
      if counts[c] < counts[mi] then mi = c end
    end

    local obj = devices[d].data
    obj['instanceName'] = names[mi]
    obj['updatedMillisecond'] = timestamp
    local json = cjson.encode(obj)
    redis.call('HSET', 'workers:'..names[mi], id, json)
    counts[mi] = counts[mi] + 1
    results[#results + 1] = redis.call('HGET', 'workers:'..names[mi], id)
  end
end

return results
