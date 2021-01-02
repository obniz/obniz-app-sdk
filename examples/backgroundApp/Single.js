const { App, AppInstanceType, Worker, Obniz } = require('../../dist')

class MyWorker extends Worker {

  /**
   * Worker lifecycle
   */

  onStart(){ 

  }

  onLoop(){
    console.log("loop");
  }

  onEnd(){

  }

  /**
   * obniz lifecycle
   */

  onObnizConnect(obniz){

  }

  onObnizLoop(obniz){

    console.log("obniz loop");
  }

  onObnizClose(obniz){

  }


  async stop(){

  }
}

const app = new App({
  appToken: 'apptoken_Tmj2JMXVXgLBYW6iDlBzQph7L6uwcBYqRmW2NvnKk_kQeiwvnRCnUJePUrsTRtXW',
  workerClass: MyWorker,
  instanceType: AppInstanceType.WebAndWorker
})

app.start();