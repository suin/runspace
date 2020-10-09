import { TypedEventEmitter } from "@suin/typed-event-emitter";
import events from "events";
import { Readable } from "stream";
import WebSocket from "ws";
import { EventEmitter } from "./events";
import {
  ErrorListener,
  MessageListener,
  RejectionListener,
  Space,
  WaitMessagePredicate,
} from "./index";

/**
 * @deprecated EXPERIMENTAL: This space type is experimental. Do not use in production.
 */
export class RemoteSpace implements Space {
  readonly #ws: WebSocket;
  #isRunning = false;
  readonly #events = new EventEmitter();
  readonly #systemEvents = new events.EventEmitter() as TypedEventEmitter<{
    ready: () => void;
    closing: () => void;
  }>;

  constructor({ url }: { readonly url: string | URL }) {
    this.#ws = new WebSocket(url)
      .on("open", this.onWebSocketOpen.bind(this))
      .on("close", this.onWebSocketClose.bind(this))
      .on("error", this.onWebSocketError.bind(this))
      .on("message", this.onWebSocketMessage.bind(this));
    this.#systemEvents
      .on("ready", this.onWebSocketReady.bind(this))
      .on("closing", this.onWebSocketClosing.bind(this));
  }

  private onWebSocketOpen(): void {
    const start: Start = "start";
    this.#ws.send(start);
  }

  private onWebSocketReady(): void {
    this.#isRunning = true;
  }

  private onWebSocketError(error: Error): void {
    this.#events.emit("error", error);
  }

  private onWebSocketMessage(data: WebSocket.Data): void {
    data = data.toString();
    if (Start.isStart(data)) {
      this.#systemEvents.emit("ready");
      return;
    }
    if (Stop.isStop(data)) {
      this.#systemEvents.emit("closing");
      return;
    }
    const message: unknown = JSON.parse(data); // todo: parse error
    this.#events.emit("message", message);
  }

  private onWebSocketClose(): void {
    this.#systemEvents.emit("closing");
  }

  private onWebSocketClosing(): void {
    this.#isRunning = false;
  }

  get isRunning(): boolean {
    return this.#isRunning;
  }

  get stdout(): Readable {
    throw new Error(`Not implemented`);
  }

  waitStart(): Promise<void> {
    return this.isRunning
      ? Promise.resolve()
      : new Promise((resolve) => this.#systemEvents.once("ready", resolve));
  }

  send(message: unknown): void {
    this.#ws.send(JSON.stringify(message)); // todo: handle serialization error
  }

  waitMessage(predicate: WaitMessagePredicate): Promise<void> {
    return this.#events.waitMessage(predicate);
  }

  stop(): Promise<void> {
    const stop: Stop = "stop";
    this.#ws.send(stop);
    this.#ws.close();
    const kill = () => this.#ws.terminate();
    const timeoutKill = setTimeout(kill, 10000);
    return this.waitStop().then(() => {
      clearTimeout(timeoutKill);
      kill();
    });
  }

  waitStop(): Promise<void> {
    return this.isRunning
      ? new Promise((resolve) => this.#systemEvents.once("closing", resolve))
      : Promise.resolve();
  }

  on(type: "message", messageListener: MessageListener): this;
  on(type: "error", errorListener: ErrorListener): this;
  on(type: "rejection", rejectionListener: RejectionListener): this;
  on(
    type: "message" | "error" | "rejection",
    messageListener: MessageListener | ErrorListener | RejectionListener
  ): this {
    this.#events.on(type, messageListener);
    return this;
  }
}

export type Start = "start";
export const Start = {
  isStart: (value: unknown): value is Start => value === "start",
};
export type Stop = "stop";
export const Stop = {
  isStop: (value: unknown): value is Stop => value === "stop",
};
