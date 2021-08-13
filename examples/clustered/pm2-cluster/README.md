# PM2 Cluster Example

Run AppSDK as cluster provided from [pm2](https://github.com/Unitech/pm2)

## How to run example

Use sample ecosystem.config.js. Replace apptoken with yours.

```javascript
module.exports = {
  apps : [
      {
        name: "pm2-cluster",
        script: "./master.js",
        instances: 2,
        exec_mode: "cluster",
        watch: true,
        env: {
          "APPTOKEN": "your token"
        }
      }
  ]
}
```

Run code by using pm2

```shell
pm2 start ecosystem.config.js
```

You may seen Two processes activated

```shell
1|pm2-cluster  | onStart instance=1
0|pm2-cluster  | onStart instance=0
```