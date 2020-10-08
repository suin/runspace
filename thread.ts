import { isObject } from "@suin/is-object";
import path from "path";
import { Readable } from "stream";
import { MessageChannel, Worker } from "worker_threads";
import { EventEmitter } from "./events";
import {
  ErrorListener,
  MessageListener,
  RejectionListener,
  Space,
  WaitMessagePredicate,
} from "./index";

const workerFile = path.join(__dirname, "thread.worker.js");

export class ThreadSpace implements Space {
  readonly #worker: Worker;
  readonly #terminateChannel = new MessageChannel();
  readonly #rejectionChannel = new MessageChannel();
  readonly #events = new EventEmitter();
  #isOnline = false;

  constructor({ filename }: { readonly filename: string }) {
    const workerData: WorkerData = { filename: path.resolve(filename) };
    this.#worker = new Worker(workerFile, { workerData })
      .on("online", this.onWorkerOnline.bind(this))
      .on("message", this.onWorkerMessage.bind(this))
      .on("error", this.onWorkerError.bind(this))
      .on("exit", this.onWorkerExit.bind(this));
    this.#rejectionChannel.port1.on(
      "message",
      this.onWorkerRejection.bind(this)
    );
  }

  get isRunning(): boolean {
    return this.#isOnline;
  }

  get stdout(): Readable {
    return this.#worker.stdout;
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
    this.#terminateChannel.port1.postMessage(undefined);
    const timeoutKill = setTimeout(() => this.#worker.terminate(), 10000);
    return this.waitStop().then(() => clearTimeout(timeoutKill));
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
    this.sendSystemPorts();
  }

  private sendSystemPorts(): void {
    const terminatePort = this.#terminateChannel.port2;
    const rejectionPort = this.#rejectionChannel.port2;
    this.#worker.postMessage({ terminatePort, rejectionPort }, [
      terminatePort,
      rejectionPort,
    ]);
  }

  private onWorkerMessage(message: unknown): void {
    this.#events.emit("message", message);
  }

  private onWorkerError(error: unknown): void {
    this.#events.emit("error", error);
  }

  private onWorkerRejection(reason: unknown): void {
    this.#events.emit("rejection", reason);
  }

  private onWorkerExit(): void {
    this.#isOnline = false;
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
