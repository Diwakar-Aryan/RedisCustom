import net from "net";
import { RedisDeserializer } from "redis.deserializer";
import { RespType } from "types";
import { RedisCommands } from "commands";

interface IRedisServer {
  /**
   * The host on which Redis Server will start
   * eg : 127.0.0.1
   */
  host: string;
  /**
   * The port on which Redis server will start listening to messages
   */
  port: number;
  /**
   * Used for debbuging purposes
   * If true, then server will log messages to console
   */
  debug: boolean;
  /**
   * This function starts listening on given host and port.
   * It also attaches various listener on connection event
   * This listener handles the messages from socket instances
   */
  startServer(): void;
  /**
   * This function returns a promise that gets resolved when all connections of server are closed and
   *  'close' event is emmitted from server.
   */
  stopServer(): Promise<void>;
}

export class RedisServer implements IRedisServer {
  host;
  port;
  debug;

  private server: net.Server;
  // private serializer:
  private map: Map<string, RespType>;
  private sockets: Map<string, net.Socket>;

  constructor(
    port: number = 6379,
    host: string = "127.0.0.1",
    debug: boolean = false
  ) {
    this.port = port;
    this.host = host;
    this.debug = debug;

    this.map = new Map<string, string>();
    this.server = new net.Server();
    this.sockets = new Map<string, net.Socket>();
  }

  startServer() {
    this.server.listen(this.port, this.host, () => {
      if (this.debug) {
        console.log(`Redis server initiated on port ${this.port}`);
      }
    });

    this.server.on("connection", (sock) => {
      this.sockets.set(sock.remoteAddress + ":" + sock.remotePort, sock);

      if (this.debug) {
        console.log(
          "Connected: " + sock.remoteAddress + ":" + sock.remoteAddress
        );
      }

      sock.on("error", (err) => {
        // End the Socket whe encountered an error.
        console.error(err.message);
        sock.end();
      });

      sock.on("close", () => {
        this.sockets.delete(sock.remoteAddress + ":" + sock.remotePort);
      });

      sock.on("data", (data) => {
        const dataStr = data.toString();
        const dataLength = dataStr.length;

        if (this.debug) {
          console.log(
            "DATA" +
              sock.remoteAddress +
              ":" +
              sock.remoteAddress +
              ":" +
              sock.remotePort +
              ":" +
              JSON.stringify(data)
          );
        }
        let currentPos = 0;

        while (currentPos < dataLength) {
          //Keep on parsing commands until you reach the end of data
          // This doesn't handle the case when the data is fragmented between two reads.
          try {
            //Deserialize the data  
            const deserializer = new RedisDeserializer(dataStr.substring(currentPos),true)
            const serializeData = deserializer.parse() as Array<string>
            
            //Update the current position
            currentPos += deserializer.getPos()

            //Handle the command recieved
            this.handleRequests(sock,serializeData);
          } catch (error) {
            /**
             *  If some error occurred while deserialization, send an error to the client.
             * This doesn't handle the case when there are multiple commands still pending after this error.
             * The execution for the data parsing is stopped after this.
             */
            if(this.debug){
                console.error(error)
            }
            sock.emit('sendRespose',new Error('Cannot Parse'))
            break
          }
        }
      });

      sock.addListener('sendResponse',(data:RespType)=>{
        //Send serialized data to the client

      })
    });
  }

  private handleRequests(sock:net.Socket,data:Array<string>){
    try {
        const command = data[0]
        switch (command){
            case RedisCommands.PING:
                this.handlePing(sock,data)
                break
            case RedisCommands.ECHO:
                this.handleEcho(sock,data)
                break
            case RedisCommands.SET:
                this.handleSet(sock,data)
                break
            case RedisCommands.GET:
                this.handleGet(sock,data)
                break
            case RedisCommands.DEL:
                this.handleDel(sock,data)
                break
            default:
                throw new Error(`Unknow Commands: ${command}`)
        }
    } catch (error) {
        if(error instanceof Error && this.debug){
            console.error(error.message)
        }
    }
  }

  private handlePing(sock:net.Socket,data:Array<string>){
    if(data === null){
        throw new Error('PING: Invalid Data')
    }
    let response = 'PONG'
    const message = data[1]
    if(message !== undefined ){
        response = message
    }
    sock.emit('sendResponse',response)
  }

  private handleEcho(sock:net.Socket,data:Array<string>){
    sock.emit('sendResponse',data[1])
  }

  private handleSet(sock:net.Socket,data:Array<string>){
    const key = data[1]
    const value = data[2]
    this.map.set(key,value)
    sock.emit('sendResponse', 'OK');
  }

  private handleGet(sock:net.Socket,data:Array<string>){
    const key = data[1]
    const response = this.map.get(key) ?? null
    if(typeof response !== 'string'){
        throw new Error(`INVALID type of value ${typeof response}`);
    }
    sock.emit('sendResponse', response)
  }

  private handleDel(sock:net.Socket,data:Array<string>){
    const key = data[1]
    const response = this.map.delete(key) ? 1 : 0
    sock.emit('sendResponse', response);
  }





  stopServer(): Promise<void> {
      return new Promise<void>((res)=>{
        //Close all sockets first
        this.sockets.forEach((sock)=>{
            sock.destroy()
        });

        //On close event resolve the Promise
        this.server.on('close',()=>{
            if(this.debug){console.log(`Redis Server stopped listening on port ${this.port}`);
            }
            res()
        })
        //Close the server
        this.server?.close()
      })
  }
}

