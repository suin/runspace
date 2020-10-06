import { isObject } from "@suin/is-object";
import { ChildProcess, fork, Serializable } from "child_process";
import path from "path";
import { createEventEmitter } from "./eventEmitter";
import {
  ErrorListener,
  MessageListener,
  RejectionListener,
  Space,
} from "./index";
import {
  isSystemMessageContainer,
  SystemMessageContainer,
} from "./systemMessage";

export class ChildProcessSpace implements Space {
  readonly #filename: string;
  readonly #events = createEventEmitter();
  #worker?: ChildProcess;

  constructor({ filename }: { readonly filename: string }) {
    this.#filename = path.resolve(filename);
  }

  get isRunning(): boolean {
    return this.#worker !== undefined;
  }

  on(
    type: "message" | "error" | "rejection",
    listener: MessageListener | ErrorListener | RejectionListener
  ): this {
    this.#events.on(type, listener);
    return this;
  }

  async start(): Promise<void> {
    const env: Env = { RUNSPACE_FILENAME: this.#filename };
    this.#worker = fork(__dirname + "/childProcess.worker.js", [], { env })
      .on("message", this.handleMessage.bind(this))
      .on("exit", () => {
        this.#worker = undefined;
      });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    this.#worker?.kill();
    return this.waitStop();
  }

  waitStop(): Promise<void> {
    return this.isRunning
      ? new Promise((resolve) => this.#worker?.once("exit", () => resolve()))
      : Promise.resolve();
  }

  send(message: unknown): void {
    this.#worker?.send(message as Serializable);
  }

  private handleMessage(message: Serializable): void {
    if (isSystemMessageContainer(message)) {
      this.handleSystemMessage(message);
      return;
    }
    this.#events.emit("message", message);
  }

  private handleSystemMessage(
    systemMessageContainer: SystemMessageContainer
  ): void {
    const message = systemMessageContainer.__runspace__;
    switch (message.type) {
      case "unhandledRejection":
        this.#events.emit("rejection", convertErrorLikeToError(message.reason));
        return;
      case "error":
        this.#events.emit("error", convertErrorLikeToError(message.error));
        return;
    }
  }
}

const convertErrorLikeToError = (errorLike: unknown): Error | unknown =>
  isError(errorLike) ? Object.assign(new Error(), errorLike) : errorLike;

const isError = (value: unknown): value is Error =>
  isObject<Error>(value) &&
  typeof value.name === "string" &&
  typeof value.message === "string" &&
  (typeof value.stack === "string" || value.stack === undefined);

export type Env = {
  readonly RUNSPACE_FILENAME: string;
};

export const Env = {
  isEnv: (env: unknown): env is Env =>
    isObject<Env>(env) && typeof env.RUNSPACE_FILENAME === "string",

  dropVariables: (env: Partial<Writable<Env>>): void => {
    delete env.RUNSPACE_FILENAME;
  },

  getFilename: (env: Env): string => env.RUNSPACE_FILENAME,
};

type Writable<T> = { -readonly [K in keyof T]: T[K] };
