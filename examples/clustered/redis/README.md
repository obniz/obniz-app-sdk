
# Redis Adaptor Cluster Example

Cluster in machines with Redis.

## How to run example

Run redis server.
Then run master and worker with your APPTOKEN and REDIS_URL info.

Start master.js. It will start master instance to manage workers and start one worker inside of itself.
```
REDIS_URL='redis://localhost:6379' APPTOKEN=**** node master.js
```

Start worker.js. It will receive tasks from manager.
```
REDIS_URL='redis://localhost:6379' APPTOKEN=**** node worker.js
```


#### instanceName

Each process should have identity. By default, `os.hostname()` is used.
In this example, worker.js using strict instanceName for testing in same machine master is working.

```javascript
const app = new App({
  instanceName: 'worker0',
```