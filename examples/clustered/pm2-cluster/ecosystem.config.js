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