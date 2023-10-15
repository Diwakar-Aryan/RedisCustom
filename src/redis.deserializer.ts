import { RespType, RespArray } from "types";

export interface IRedisDeserializer {
  /**
   * This function parses the text input.
   * It also raises Error if the input is invalid.
   */
  parse(): RespType;
  /**
   * Returns the current position of the cursor while traversing the input.
   */
  getPos(): number;
}

export class RedisDeserializer implements IRedisDeserializer {
  private input: string;
  private pos: number;
  private inputLength: number;
  private multipleCommands: boolean;

  constructor(input: string, multipleCommands: boolean = false) {
    this.input = input;
    this.pos = 0;
    this.inputLength = input.length;
    this.multipleCommands = multipleCommands;
  }
  getPos(): number {
    return this.pos;
  }
  parse(): RespType {
    const output = this.parseValue();
    if (this.hasNext() && !this.multipleCommands) {
      throw new Error(
        `Invalid Token ${JSON.stringify(this.getCurrentToken())} at ${this.pos}`
      );
    }
    return output;
  }
  /**
   * This function parses a single value, which can be:
   *    Simple String
   *    Error
   *    Integer
   *    Bulk String
   *    Arrays
   */
  private parseValue(): RespType {
    const token = this.getCurrentToken();
    switch (token) {
      case "+":
        return this.parseSimpleStrings();
      case "-":
        return this.parseError();
      case ":":
        return this.parseInteger();
      case "$":
        return this.parseBulkStrings();
      case "*":
        return this.parseArrays();
      default:
        throw new Error(`Invalid token ${token} at ${this.pos}`);
    }
  }

  private hasNext(): boolean {
    return this.input.codePointAt(this.pos) !== undefined;
  }

  private parseError(): Error {
    this.consumeToken("-");
    let message = "";
    while (this.getCurrentToken() !== "\r" && this.pos < this.inputLength) {
      message += this.getCurrentToken();
      this.consumeToken();
    }
    this.consumeToken("\n");
    this.consumeToken("\r");
    return new Error(message);
  }

  private parseInteger(): number {
    this.consumeToken(":");
    let ans = 0;

    while (this.getCurrentToken() !== "\r" && this.pos < this.inputLength) {
      ans = ans * 10 + parseInt(this.getCurrentToken());
      this.consumeToken();
    }
    this.consumeToken("\r");
    this.consumeToken("\n");
    return ans;
  }

  private parseSimpleStrings(): string {
    this.consumeToken("+");
    let str = "";
    while (this.getCurrentToken() !== "\r" && this.pos < this.inputLength) {
      str += this.getCurrentToken();
      this.consumeToken();
    }
    this.consumeToken("\r");
    this.consumeToken("\n");
    return str;
  }

  private parseBulkStrings(): string | null {
    this.consumeToken("$");
    const length = this.getLength();
    if (length === -1) {
      return null;
    }
    let str = "";
    let i = 0;
    while (i < length && this.pos < this.inputLength) {
      str += this.getCurrentToken();
      this.consumeToken();
      i++;
    }
    this.consumeToken("\r");
    this.consumeToken("\n");
    return str;
  }

  private getLength(): number {
    let ans = 0;
    if (this.getCurrentToken() === "-") {
      this.consumeToken("-");
      this.consumeToken("1");
      this.consumeToken("\r");
      this.consumeToken("\n");
      return -1;
    }

    while (this.pos < this.inputLength && this.getCurrentToken() !== "\r") {
      ans = ans * 10 + parseInt(this.getCurrentToken());
      this.consumeToken();
    }
    this.consumeToken("\r");
    this.consumeToken("\n");

    return ans;
  }

  private parseArrays(): RespArray{
    this.consumeToken('*')
    const arrayLength = this.getLength()
    if(arrayLength === -1){
        return null
    }
    if(arrayLength === 0){
        return []
    }
    const arr = new Array<any>(arrayLength)
    let i =0 
    while(i<arrayLength){
        if(this.pos >= this.inputLength){
            
        const elem = this.parseValue();
        arr[i] = elem
        i++
        }
    }
    return arr
  }

  private consumeToken(token?: string) {
    if (token) {
      if (this.getCurrentToken() !== token) {
        throw new Error(`Invalid token at ${this.pos}`);
      }
    }
    this.pos++;
  }

  private getCurrentToken() {
    return this.input[this.pos];
  }
}
