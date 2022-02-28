-- get slaves
local workerKeys = redis.call('KEYS', 'workers:*')
if #workerKeys == 0 then return {err='worker not found'} end
-- check exist
for i = 1 , #workerKeys do
  -- note: this will not work on redis cluster
  local exist = redis.call('HEXISTS', workerKeys[i], KEYS[1])
  if exist == 1 then return {err='already installed'} end
end
-- get counts and check min
local minKey = workerKeys[1]
local minCount
for i = 1 , #workerKeys do
  local count = redis.call('HLEN', workerKeys[i])
  if minCount == nil then
    minCount = count
  end
  if minCount >= count then
    minKey = workerKeys[i]
    minCount = count
  end
end
-- add
local instName = string.match(minKey, "workers:(.+)")
local obj = cjson.decode(ARGV[1])
obj['instanceName'] = instName
local json = cjson.encode(obj)
local setres = redis.call('HSET', minKey, KEYS[1], json)
local result = redis.call('HGET', minKey, KEYS[1])
return { result }