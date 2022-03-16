# Lua Scripts

このフォルダ内の LuaScript は `install_store/RedisInstallStore.ts` で使用されています。  
ファイルロードを不要にするため、当該ファイル内で文字列として定義したものを使用しています。

The LuaScript in this folder is used by `install_store/RedisInstallStore.ts`.  
To reduce file loading, they are defined as strings in the file.

## AutoCreate
指定した obnizId - データ のペアを、稼働している中で最も動作しているWorker数が少ないWorkerのリストに追加します。  
Worker一覧の取得、振り分け先の決定、リストへの登録をアトミックに実行します。

The specified obnizId - data pair is added to the list of Workers running the fewest number of Workers in operation.  
Get a list of Workers, decide where to assign them, and register them in the list atomically.

## AutoRelocate
指定した obnizId のデータを、稼働している中で最も動作しているWorker数が少ないWorkerのリストに移動します。指定した obnizId が既にリストに追加されている必要があります。  
Worker一覧の取得、Workerのデータ取得、振り分け先の決定、新しいリストへの登録、古いリストからの削除をアトミックに実行します。

Moves the data for the specified obnizId to the list of Workers running the fewest number of Workers in operation. The specified obnizId must already be added to the list.  
Get Worker list, get Worker's data, decide where to sort, register to a new list, and delete from an old list atomically.

## UpdateInstall
指定した obnizId - 新しいデータ のペアを、既に稼働中のWorkerのデータに上書きします。
Workerのデータ取得、データの上書きをアトミックに実行します。

Overwrites the specified obnizId - new data pair with the already running Worker's data.  
Get Worker data and overwrite data atomically.