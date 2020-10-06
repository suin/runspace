import { isObject } from "@suin/is-object";
import path from "path";
import { Worker } from "worker_threads";
import { createEventEmitter, waitMessage } from "./eventEmitter";
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

export class ThreadSpace implements Space {
  readonly #filename: string;
  readonly #events = createEventEmitter();
  #worker?: Worker;
  #isOnline = false;

  constructor({ filename }: { readonly filename: string }) {
    this.#filename = path.resolve(filename);
  }

  get isRunning(): boolean {
    return this.#isOnline;
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

  start(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.#isOnline = false;
      const workerData: WorkerData = { filename: this.#filename };
      this.#worker = new Worker(__dirname + "/thread.worker.js", { workerData })
        .on("message", this.handleMessage.bind(this))
        .on("error", (error) => this.#events.emit("error", error))
        .on("online", () => {
          this.#isOnline = true;
          resolve();
        })
        .on("exit", () => {
          this.#isOnline = false;
          this.#worker = undefined;
        });
    });
  }

  async stop(): Promise<void> {
    await this.#worker?.terminate();
  }

  waitStop(): Promise<void> {
    return this.isRunning
      ? new Promise((resolve) => this.#worker?.once("exit", () => resolve()))
      : Promise.resolve();
  }

  send(message: unknown): void {
    this.#worker?.postMessage(message);
  }

  waitMessage(predicate: WaitMessagePredicate): Promise<void> {
    return waitMessage(this.#events, predicate);
  }

  private handleMessage(message: unknown): void {
    if (isSystemMessageContainer(message)) {
      this.handleSystemMessage(message);
      return;
    }
    this.#events.emit("message", message);
  }

  private handleSystemMessage(
    systemMessageContainer: SystemMessageContainer
  ): void {
    const data = systemMessageContainer.__runspace__;
    if (data.type === "unhandledRejection") {
      this.#events.emit("rejection", data.reason);
      return;
    } else {
      // todo
    }
  }
}

export type WorkerData = {
  readonly filename: string;
};

export const WorkerData = {
  is(value: unknown): value is WorkerData {
    return isObject<WorkerData>(value) && typeof value.filename === "string";
  },
};
