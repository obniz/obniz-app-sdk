
# Redis Adaptor Cluster Example

Cluster in machines with Redis.

## How to run example

Run redis server.
Then run master and worker with your APPTOKEN and REDIS_URL info.

```
REDIS_URL='redis://localhost:6379' APPTOKEN=**** node master.js
```

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