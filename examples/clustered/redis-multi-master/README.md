# Redis Adaptor Multi Master Example

Clustering multiple Managers or Masters with Redis.  
Manager and Master can operate together at the same time.

## How to run example

### Redis
Run redis server.

### Master
Start masters. It will start master instance to manage workers and start one worker inside of itself.
```
REDIS_URL='redis://localhost:6379' APPTOKEN=**** node master1.js
REDIS_URL='redis://localhost:6379' APPTOKEN=**** node master2.js
```

### Manager
Start managers. It will start manager instance to manage workers.
```
REDIS_URL='redis://localhost:6379' APPTOKEN=**** node manager1.js
REDIS_URL='redis://localhost:6379' APPTOKEN=**** node manager2.js
```

### Worker (Slave)
Start workers. It will receive tasks from masters or managers.
```
REDIS_URL='redis://localhost:6379' APPTOKEN=**** node worker1.js
REDIS_URL='redis://localhost:6379' APPTOKEN=**** node worker2.js
```

## instanceName

Each process should have identity. By default, `os.hostname()` is used.  
When using redis, the distinction is as follows internally.

<!-- Note: Using &#8203; for formatting. -->

- Master (master1.js, instanceName: 'master1')
  - **master:**&#8203;master1
  - **slave:**&#8203;master1
- Manager (manager1.js, instanceName: 'manager1')
  - **master:**&#8203;manager1
- Worker / Slave (worker1.js, instanceName: 'worker1')
  - **slave:**&#8203;worker1

Masters( or Managers) and Slaves work even if they have duplicate names.  
If there are duplicate names within masters and managers, it will not work correctly.  
Similarly, if there are duplicate names within slaves, it will not work properly.  

```javascript
const app = new App({
  instanceName: 'worker1',
});
```
