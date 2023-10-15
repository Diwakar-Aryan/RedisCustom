import { RedisClient } from "redis.client";
import { RedisCommands } from "commands";

const client  = new RedisClient()

client.connect()

process.stdin.on('data',async (input)=>{
    //Read the input provided by user
    const data = input.toString().trim()
    if(data === 'exit'){
        await client.disconnect()
        process.exit()
    }

    try {
        const arr = data.split(' ')
        const command = arr[0]

        //Cross check if a valid message is provided or not
        //Send commands to a server
        switch(command){
            case RedisCommands.PING:
                let message = arr[1]
                await client.ping(message)
                break
                
            case RedisCommands.ECHO:
                message = arr[1]
                if(message === undefined){
                    console.error('Please provide a message');
                    break
                }
                await client.echo(message)
                break
            case  RedisCommands.SET:{
                const key = arr[1]
                const value = arr[2]
                if(key === undefined || value === undefined){
                    console.error('Invalid key or value');
                    break
                    
                }
                await client.set(key,value)
                break
            }
                
            case RedisCommands.GET: {
                const key = arr[1]
                if(key === undefined){
                    console.error('Please provide a key');
                    break
                }
                const value = await client.get(key)
                console.log(value);
                break
            }
            case RedisCommands.DEL:{
                const key = arr[1]
                if(key === undefined){
                    console.error('Please provide a key');
                    break
                }
                const value = await client.delete(key)
                console.log(value);
                break
            }
            default:
                console.error('Invalid command %s',command);
                break

        }
    } catch (error) {
        if(error instanceof Error){
            console.error(error.message);
            
        }
    }
})