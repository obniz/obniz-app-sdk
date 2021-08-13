# MQTT Adaptor Cluster Example

Cluster in machines with MQTT.

## How to run example

Just run master and worker with your APPTOKEN

```
APPTOKEN=**** node master.js
```

```
APPTOKEN=**** node worker.js
```

#### Comunication

You should open 1883 Port to let each process communicate each other by using MQTT.

#### instanceName

Each process should have identity. By default, `os.hostname()` is used.
In this example, worker.js using strict instanceName for testing in same machine master is working.

```javascript
const app = new App({
  instanceName: 'worker0',
```