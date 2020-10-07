import { isObject } from "@suin/is-object";
import path from "path";
import { Worker } from "worker_threads";
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

const workerFile = path.join(__dirname, "thread.worker.js");

export class ThreadSpace implements Space {
  readonly #worker: Worker;
  readonly #events = new EventEmitter();
  #isOnline = false;

  constructor({ filename }: { readonly filename: string }) {
    const workerData: WorkerData = { filename: path.resolve(filename) };
    this.#worker = new Worker(workerFile, { workerData })
      .on("online", this.onWorkerOnline.bind(this))
      .on("message", this.onWorkerMessage.bind(this))
      .on("error", this.onWorkerError.bind(this))
      .on("exit", this.onWorkerExit.bind(this));
  }

  get isRunning(): boolean {
    return this.#isOnline;
  }

  waitStart(): Promise<void> {
    return new Promise((resolve) => this.#worker.once("online", resolve));
  }

  send(message: unknown): void {
    this.#worker.postMessage(message);
  }

  waitMessage(predicate: WaitMessagePredicate): Promise<void> {
    return this.#events.waitMessage(predicate);
  }

  async stop(): Promise<void> {
    await this.#worker.terminate();
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

  private onWorkerOnline(): void {
    this.#isOnline = true;
  }

  private onWorkerMessage(message: unknown): void {
    if (isSystemMessageContainer(message)) {
      this.handleSystemMessage(message);
      return;
    }
    this.#events.emit("message", message);
  }

  private onWorkerError(error: unknown): void {
    this.#events.emit("error", error);
  }

  private onWorkerExit(): void {
    this.#isOnline = false;
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

/**
 * @internal
 */
export type WorkerData = {
  readonly filename: string;
};

/**
 * @internal
 */
export const WorkerData = {
  is(value: unknown): value is WorkerData {
    return isObject<WorkerData>(value) && typeof value.filename === "string";
  },
};
