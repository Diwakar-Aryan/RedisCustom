import { RedisServer } from "redis.server";

const redisServer = new RedisServer(6379,undefined,true)
redisServer.startServer()