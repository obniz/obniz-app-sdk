import { Server } from "../../src/index";

const server = new Server();
server.start(process.env.PORT ? parseInt(process.env.PORT) : 3003);