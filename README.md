# RedisCustom  

The aim of this repo is to write a basic Redis server that can handle concurrent clients using the RESP Protocol.  

commands.ts: The commands supported by the server  
redis.client.ts: My own class implementation of the Redis client. This is not part of the challenge, but I wanted to implement the client as well.  
client.index.ts: Command line version of the Redis client  
redis.server.ts: The Redis server implementation   
redis.server.index.ts: Command line version of the Redis server  
redis.serializer.ts: The serializer used by the Redis server to serialize the data  
redis.deserializer.ts: The deserializer used by the Redis server to deserialize the data  
types.ts: The different types of objects support by RESP protocol  

