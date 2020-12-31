import {App} from '../../src/index'
import {Worker} from './Worker'

const app = new App({appToken: "aa", workerClass : Worker});

app.start();
