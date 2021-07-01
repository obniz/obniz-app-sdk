[日本語はこちら](./README-ja.md)


This is a framework for node js legs that use obniz.
Crotch and online / reprocessing are automatic.


## Comparison diagram

![](./doc/images/description.png)


## program

```
const { App, AppInstanceType, Worker } = require('obniz-app-sdk')
const Obniz = require("obniz");

class MyWorker extends Worker {

  /**
   * Worker lifecycle
   */

  async onStart(){

  }

  async onLoop(){
    console.log("loop");
  }

  async onEnd(){

  }

  /**
   * obniz lifecycle
   */

  async onObnizConnect(obniz){

  }

  async onObnizLoop(obniz){

    console.log("obniz loop");
  }

  async onObnizClose(obniz){

  }


}

const app = new App({
  appToken: 'apptoken_Tmj2JMXVXgLBYW6iDlBzQph7L6uwcBYqRmW2NvnKk_kQeiwvnRCnUJePUrsTRtXW',
  workerClass: MyWorker,
  instanceType: AppInstanceType.Master,
  obnizClass: Obniz 
})

app.start();

```


It's a temporary app

| Key | description |
|: --- |: --- |
| WorkerClass | Can do a lot of processing |
| appToken | Attach a choted token on obnizCloud and specify the winning token |
| instanceType | Please specify the master for the first unit and the slave for the second unit. |
| obnizClass |  Workerで使用するobnizクラスを指定してください。 |

Good, see inside for optional parameters.


## Example

Examples is [here](./examples)

## Application life cycle


![](./doc/images/lifecycle.png)
