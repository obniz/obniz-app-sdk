
obnizを使用したnodejsアプリを作る際のフレームワークです。
スケールやオンライン／オフライン処理を自動で行います。

## 全体構成図

### バックグラウンドで動くアプリの場合
![](./doc/images/description.png)


## プログラム

```
const { App, AppInstanceType, Worker, Obniz } = require('../../dist')

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


Appの引数はこちらのとおりです

|key | mean |
|:---|:---|
| workerClass |  各デバイスの処理を記載したMyWorkerクラスを指定します|
| appToken |  obnizCloud上でホステッドアプリを作成し、そのアプリのトークンを指定します|
| instanceType |  オートスケール時のために必要です。1台目をMaster、2台目以降はSlaveを指定してください。|

その他、オプションのパラメータはプログラム内を参照してください。


## サンプルプログラム

サンプルは[こちら](./examples)

## ライフサイクル

バックグラウンド部分のライフサイクル
![](./doc/images/lifecycle.png)




