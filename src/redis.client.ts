import net from "net";
import { RedisSerializer } from "redis.serializer";
import { RedisDeserializer } from "redis.deserializer";
import { RedisCommands } from "commands";
import { Queue } from "queue";

interface IRedisClient {
  host: string;
  port: number;

  connect(): void;

  disconnect(): void;

  ping(message?: string): void;

  set(key: string, value: string): void;

  echo(message: string): void;

  get(key: string): Promise<string | null>;

  delete(key: string): Promise<number>;

  setTimeout(timeout: number): void;
}

interface ICommandWaitingForReply {
  resolve(reply?: unknown): void;
  reject(reply?: unknown): void;
}

class CommandWaitingForReply {
  resolve: any;
  reject: any;

  constructor(
    resolve: (value: unknown) => void,
    reject: (value: unknown) => void
  ) {
    this.resolve = resolve;
    this.reject = reject;
  }
}

export class RedisClient implements IRedisClient {
  host: string;
  port: number;
  private sock?: net.Socket;
  private serializer = new RedisSerializer();
  private commandsQueue: Queue<ICommandWaitingForReply>;

  constructor(host: string = "127.0.0.1", port: number = 6379) {
    this.port = port;
    this.host = host;
    this.commandsQueue = new Queue<ICommandWaitingForReply>(1000);
  }

  setTimeout(timeout: number): void {
    if (this.sock) {
      this.sock.setTimeout(timeout);
    }
  }

  async connect(): Promise<void> {
    this.sock = net.connect(this.port, this.host);
    this.sock.setTimeout(30000);
    this.sock.on("connect", () => {
      console.log("Connected");
    });
    this.sock.on("timeout", () => {
      console.log("Socket Timeout");
      this.sock?.end();
    });
    this.sock.on("error", (err) => {
      console.error(err);
      this.sock?.destroy();
    });
    this.sock.on("close", () => {
      console.log("Connection closed");
    });
    this.sock.on("data", (data) => {
      const dataStr = data.toString();
      const elem = this.commandsQueue.dequeue();

      //Get element from queue
      try {
        //Deserialize the response and resolve promise with the response
        const ans = new RedisDeserializer(dataStr).parse();
        elem?.resolve(ans);
      } catch (error) {
        // If some error occurred in Deserialization, then reject the Promise.
        console.log(error);
        if (error instanceof Error) {
          elem?.reject(error.message);
        }
      }
    });
  }

  private async write(data: Array<string>): Promise<unknown> {
    //Check if socket is open
    if (this.sock && this.sock.readyState === "open") {
      // Creates a new Promise and appends to the queue.    
      // When the data is received from the server,
      // the Promise is resolved or rejects based on the servers' response.
      const newPromise = new Promise((resolve, reject) => {
        const elem = new CommandWaitingForReply(resolve, reject);
        this.commandsQueue.enqueue(elem);
      });
       // Write the serialized data in RESP format
       this.sock.write(this.serializer.serialize(data, true));
       return newPromise;
    }
    throw new Error('Connection is not established');
  }

  async disconnect(): Promise<void> {
      this.sock?.destroy()
  }

  async ping(message?: string | undefined): Promise<void> {
      const data: string[] = [RedisCommands.PING]
      if(message !== undefined){
        data.push(message)
      }
      console.log(await this.write(data));
  }

  async set(key: string, value: string): Promise<void> {
      const data = [RedisCommands.SET,key,value]
      console.log(await this.write(data));
      
  }

  async echo(message: string): Promise<void> {
      const data: string[] = [RedisCommands.ECHO,message]
      console.log(await this.write(data));
      
  }

  async get(key: string): Promise<string | null> {
      const data :string[] = [RedisCommands.GET,key]
      const response = await this.write(data)
      if(typeof response === 'string' && response === null){
        return response
      }
      if(response instanceof Error){
        throw response
      }
      return null
  }

  async delete(key: string): Promise<number> {
      const data = [RedisCommands.DEL,key]
      const response = await this.write(data)
      if(typeof response === 'number'){
        return response
      }
      if(response instanceof Error){
        throw response
      }
      throw 0
  }


  
}
