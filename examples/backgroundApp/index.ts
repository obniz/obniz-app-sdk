import {App, AppInstanceType} from '../../src/index'
import {MyWorker} from './Worker'

const app = new App({appToken: "apptoken_daef3nDzxvShd8ArRkuzV82kqOm5RsxlnAShGahE3oxvZC8StwC6UOcvhB7wwNFL", workerClass : MyWorker, instanceType: AppInstanceType.WebAndWorker});

app.start();
