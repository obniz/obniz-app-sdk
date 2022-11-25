--- get running managers
local runningManagerKeys = redis.call('KEYS', 'master:*:heartbeat')

--- add heartbeat
local result = redis.call('SET', 'master:'..KEYS[1]..':heartbeat', redis.call('TIME')[1], 'EX', 20)
if not result == 'OK' then return {err='FAILED_ADD_MANAGER_HEARTBEAT'} end
return {#runningManagerKeys == 0 and 'true' or 'false'}