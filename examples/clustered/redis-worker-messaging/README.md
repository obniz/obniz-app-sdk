
# Worker-to-Worker Messaging Example (Redis Cluster)

This example demonstrates the worker-to-worker messaging API on top of the
Redis-backed cluster adaptor:

- `this.request(key, timeout)` — broadcast a request to every Worker in the
  cluster and collect every peer's response.
- `this.directRequest(obnizId, key, timeout)` — send a request to a single
  Worker identified by its `obnizId` and receive only that peer's response.

Every Worker (`MessagingWorker.js`) keeps a local `tick` counter that
increments once per second inside `onLoop()`. Every 15 seconds, each Worker
fans out a broadcast asking every peer for its current tick, then picks a
random peer and sends a direct follow-up asking for a greeting. Both
responses are logged.

Start times are jittered deterministically per `obnizId` so that logs from
multiple Workers in the same process don't overlap.

## How to run

1. Start a redis server locally (or point `REDIS_URL` at one).

2. Start the master. It manages workers and also runs one Slave inside
   itself.

   ```
   REDIS_URL='redis://localhost:6379' APPTOKEN=**** node master.js
   ```

3. In another terminal, start one or more worker processes. Give each a
   unique `INSTANCE_NAME` so they don't collide on the cluster instance id.

   ```
   REDIS_URL='redis://localhost:6379' APPTOKEN=**** INSTANCE_NAME=worker0 node worker.js
   REDIS_URL='redis://localhost:6379' APPTOKEN=**** INSTANCE_NAME=worker1 node worker.js
   ```

With at least two obniz devices registered to your app, you should see
output similar to:

```
[1234-5678] --> broadcast request('tick')
[1234-5678] <-- broadcast response: { '1234-5678': '15', '8765-4321': '15' }
[1234-5678] --> directRequest('8765-4321', 'hello')
[1234-5678] <-- direct response: hello from 8765-4321
```

## Notes

- `request()` resolves as soon as every Slave in the cluster has answered,
  so it does not wait for the full timeout in the common case.
- `directRequest()` resolves on the first matching response from the Slave
  that owns the target `obnizId`; other Slaves do not reply.
- If a Worker is the only one in the cluster, `request('tick')` still
  returns its own entry and the direct step is skipped.
