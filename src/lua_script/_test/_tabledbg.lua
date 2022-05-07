-- for debug
local function tabledbg (keys)
  for k, v in ipairs(keys) do
    redis.log(redis.LOG_WARNING, cjson.encode(v))
  end
end