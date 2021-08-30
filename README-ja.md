
obnizを使用したnodejsのホステッドアプリを作る際のフレームワークです。
あなたのプログラムをこのSDKを使い常時稼働させることでアプリがインストールされているデバイスをこのプログラムで操作することができます。
デバイス追加・削除・設定変更のたびにプログラム変更や他の作業を行う必要はありません。obnizCloudとこのSDkがあなたのプログラムを自動で適用します。
また、このSDKは複数マシンインスタンスに分かれて負荷分散を行うことで大量のデバイスを操作することが可能で、大量デバイスの長期的な稼働を支援します。

機能
- obnizCloudとの連携によるプログラムの動作
- 複数インスタンスでの負荷分散モード
- pm2によるマルチコア負荷分散対応


## System Architecture

![](./doc/images/description.png)


## 導入方法

### Installing SDK

nodejsプロジェクトを作成し、sdkをインストールします。

```
$ npm i obniz-app-sdk
```

### Worker

デバイス制御のためのnodejsのプログラムを用意し、obniz-app-sdkを取り込みます。

Workerクラスの子クラスを作成することになりますが、これがデバイスごとにインスタンス化され実行されます。Appにはアプリの情報やスケール方法を指定します。

以下ではデバイスでbluetoothのスキャンを行いlogに出力する例を示しています。


```javascript
const { App, AppInstanceType, Worker } = require('obniz-app-sdk')
const Obniz = require("obniz");

class MyWorker extends Worker {

  // あるobnizに接続できたときに１度のみ呼ばれる
  // 引数の obniz は obniz.jsの各obnizのインスタンスと同じです。
  async onObnizConnect(obniz){
    await obniz.ble.initWait();
  }

  // デバイスとつながっている間は繰り返し実行される
  // obniz.onloopと同じくデバイスとのpingWait()を常時行いループする。
  // 引数の obniz は obniz.jsの各obnizのインスタンスと同じです。
  async onObnizLoop(obniz){
    const peripherals = await obniz.ble.scan.startAllWait(null, {
      duration : 10
    });
    console.log(`founded beacons by obniz ${obniz.id} length=${peripherals.length}`)
  }

}

const app = new App({
  appToken: process.env.APPTOKEN,
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
| obnizClass |  Workerで使用するobnizクラスを指定してください。 |
| obnizOption | `new Obniz()`の第２引数です |
| database | 複数マシンの連携モードを指定します。`memory`, `redis`, `mqtt`が選択できます |
| databaseConfig | 複数マシン連携のDB接続方法を指定します |
| instanceName | このプロセスを識別する文字列を指定します。デフォルトで`os.hostname()`が使用されます |

その他、オプションのパラメータはプログラム内(App.ts)を参照してください。

### obnizCloud

obnizCloud上でホステッドアプリを作成します

[ドキュメント](https://obniz.com/ja/doc/reference/cloud/app/hostedapp)

また、作成されたアプリを利用したいデバイスにインストールします。

[インストールについて](https://obniz.com/ja/doc/reference/cloud/app/install)

### Deploy

このnodejsプロジェクトをサーバーで稼働させます。下記は[pm2](https://github.com/Unitech/pm2)の例です。

```shell
$ npm install pm2 -g
$ pm2 startup ubuntu
$ pm2 start index.js
$ pm2 save
```

稼働中は常にobnizCloudと連携を取りインストールされているデバイスの追加・削除の監視を行いWorkerの増減を行います。

## Examples

サンプルは[こちら](./examples)

## Multi-Machines

このプログラムを複数マシンで稼働・連携して大量のデバイスを操作することが可能です。
モードは`database`で指定します。

以下負荷分散の特徴です

- MasterプロセスもWorkerとして機能します。
- すべての負荷が均一になるように分散します。
- あとからマシン追加を検知しても動作中のものを停止->移動はしません。

### `database:'memory'`

[Example](./examples/single-instance/basic.js)

`memory`はシングルインスタンスモードです。複数コアでの分散複数マシンでの分散は行われません

### `database:'redis'`

[Example](./examples/clustered/redis)

redisサーバーを用いたプロセス間連携と負荷分散を行います。
各マシンから共通のredisサーバーにアクセスできる必要があります。

```javascript
// Example
{
  database: "redis",
  databaseConfig: process.env.REDIS_URL|| "redis://localhost:6379"
}
```

### `database:'mqtt'`

[Example](./examples/clustered/mqtt)

MasterプロセスがMQTTブローカーとなり、他のプロセスがそれに接続することで連携します。Redisによる負荷分散と異なりサーバーを立ち上げる必要はありません。

```javascript
// Example
{
  database: "mqtt",
  databaseConfig: "127.0.0.1",
}
```


### Multi-Core

[Example](./examples/clustered/pm2-cluster)

pm2のマルチコア向けcluster機能に対応しており、CPUの最適な活用が行なえます。
この機能は複数マシンでの負荷分散が有効なときのみ機能します(`database:'memory'`では機能しません)。
設定の必要はなく、Exampleのように通常通り起動すれば自動的にpm2 clusterを識別し複数プロセスとして起動します。

複数起動したくない場合はpm2においてclusterをオフにするかclusterのインスタンス数を1にしてください。

## LifeCycle

WorkerクラスにはLifeCycleがあります。

```javascript
class MyWorker extends Worker {

  /**
   * Worker lifecycle
   */

  async onStart(){
    console.log("onStart");
  }

  async onLoop(){
    console.log("onLoop");
  }

  async onEnd(){
    console.log("onEnd");
  }

  async onRequest(key) {
    return `response from ${this.obniz.id}`
  }

  /**
   * obniz lifecycle
   */

   async onObnizConnect(obniz){
    console.log(`connected to obniz ${obniz.id} ${obniz.metadata.description}`);
  }

  async onObnizLoop(obniz){
    console.log(`obniz loop ${obniz.id} ${obniz.metadata.description}`);
  }

  async onObnizClose(obniz){
    console.log(`obniz disconnected from ${obniz.id} ${obniz.metadata.description}`);
  }


}
```

ライフサイクル図は以下のとおりです。

![](./doc/images/lifecycle.png)

## Performance

1マシンで操作可能なobnizデバイス数はプログラムによって異なります。リソース負荷によって調整が必要です。以下参考値となります。

1Ghz, 1Core, 1GB Memoryのマシンにおいて

1インスタンスでのobnizデバイス数の推奨範囲 | 内容
---|---
300-1,000 | BLEビーコンの検知と収集情報の定期的な別サーバーへのAPI送信な場合
30-200 | 接続するBLEデバイスで頻繁な通信と分析が必要な場合
100-500 | AD変換し電圧異常を検知・別サーバーへAPI送信するようなプログラムの場合


