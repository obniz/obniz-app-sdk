import {App, AppInstanceType} from '../../src/index'
import {MyWorker} from './Worker'

const app = new App({appToken: "aa", workerClass : MyWorker, instanceType: AppInstanceType.WebAndWorker});

app.start();
