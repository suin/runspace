import { isObject } from "@suin/is-object";
import { ChildProcess, fork, Serializable } from "child_process";
import path from "path";
import { Readable } from "stream";
import { EventEmitter } from "./events";
import {
  ErrorListener,
  MessageListener,
  RejectionListener,
  Space,
  WaitMessagePredicate,
} from "./index";
import {
  isSystemMessageContainer,
  SystemMessageContainer,
} from "./systemMessage";

const workerFile = path.join(__dirname, "childProcess.worker.js");

export class ChildProcessSpace implements Space {
  readonly #worker: ChildProcess;
  readonly #events = new EventEmitter();
  #isRunning: boolean;

  constructor({ filename }: { readonly filename: string }) {
    const env: Env = { RUNSPACE_FILENAME: path.resolve(filename) };
    this.#worker = fork(workerFile, [], { env, stdio: "pipe" })
      .on("message", this.onWorkerMessage.bind(this))
      .on("exit", this.onWorkerExit.bind(this));
    this.#isRunning = true;
  }

  get isRunning(): boolean {
    return this.#isRunning;
  }

  get stdout(): Readable {
    return this.#worker.stdout!;
  }

  async waitStart(): Promise<void> {
    return undefined;
  }

  send(message: unknown): void {
    this.#worker.send(message as Serializable);
  }

  waitMessage(predicate: WaitMessagePredicate): Promise<void> {
    return this.#events.waitMessage(predicate);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    this.#worker.kill();
    return this.waitStop();
  }

  waitStop(): Promise<void> {
    return this.isRunning
      ? new Promise((resolve) => this.#worker.once("exit", () => resolve()))
      : Promise.resolve();
  }

  on(type: "message", messageListener: MessageListener): this;
  on(type: "error", errorListener: ErrorListener): this;
  on(type: "rejection", rejectionListener: RejectionListener): this;
  on(
    type: "message" | "error" | "rejection",
    listener: MessageListener | ErrorListener | RejectionListener
  ): this {
    this.#events.on(type, listener);
    return this;
  }

  private onWorkerMessage(message: Serializable): void {
    if (isSystemMessageContainer(message)) {
      this.handleSystemMessage(message);
      return;
    }
    this.#events.emit("message", message);
  }

  private onWorkerExit(): void {
    this.#isRunning = false;
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

/**
 * @internal
 */
export type Env = {
  readonly RUNSPACE_FILENAME: string;
};

/**
 * @internal
 */
export const Env = {
  isEnv: (env: unknown): env is Env =>
    isObject<Env>(env) && typeof env.RUNSPACE_FILENAME === "string",

  dropVariables: (env: Partial<Writable<Env>>): void => {
    delete env.RUNSPACE_FILENAME;
  },

  getFilename: (env: Env): string => env.RUNSPACE_FILENAME,
};

type Writable<T> = { -readonly [K in keyof T]: T[K] };
