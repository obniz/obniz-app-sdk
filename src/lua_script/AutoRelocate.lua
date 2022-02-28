-- get slaves
local workerKeys = redis.call('KEYS', 'workers:*')
if #workerKeys == 0 then return {err='worker not found'} end
-- check exist
local nowKey
local expectNowKeys = {}
for i = 1 , #workerKeys do
  -- note: this will not work on redis cluster
  local exist = redis.call('HEXISTS', workerKeys[i], ARGV[1])
  if exist == 1 then
    nowKey = workerKeys[i]
  else
    table.insert(expectNowKeys, workerKeys[i])
  end
end
if nowKey == nil then return {err='not installed'} end
if #expectNowKeys == 0 then return {err='no other available instances'} end
-- get counts and check min expect
local minKey = expectNowKeys[1]
local minCount
for i = 1 , #expectNowKeys do
  local count = redis.call('HLEN', expectNowKeys[i])
  if minCount == nil then
    minCount = count
  end
  if minCount >= count then
    minKey = expectNowKeys[i]
    minCount = count
  end
end
-- add
local instName = string.match(minKey, "workers:(.+)")
local nowObj = cjson.decode(redis.call('HGET', nowKey, ARGV[1]))
local newObj = nowObj
local timeres = redis.call('TIME')
local timestamp = timeres[1]
newObj['instanceName'] = instName
newObj['updatedMillisecond'] = timestamp
local json = cjson.encode(newObj)
local setres = redis.call('HSET', minKey, ARGV[1], json)
local result = redis.call('HGET', minKey, ARGV[1])
local delres = redis.call('HDEL', nowKey, ARGV[1])
return { result }