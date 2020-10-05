export { ThreadSpace } from "./thread";
export { ChildProcessSpace } from "./childProcess";

export interface Space {
  /**
   * Returns true if this space is running.
   */
  readonly isRunning: boolean;

  /**
   * Start this space.
   */
  start(): Promise<void>;

  /**
   * Stops this space.
   */
  stop(): Promise<void>;

  /**
   * Waits for that the program inside this space stops.
   */
  waitStop(): Promise<void>;

  /**
   * Sends a message to the program inside this space.
   * @param message Any type of value can be sent. In the some space types, the message is restricted by `JSON.stringify`; recursive data and non-JSON-serializable values cannot to be sent.
   */
  send(message: unknown): void;

  /**
   * The `message` event is emitted when the program inside this space sends a message via `process.send()`.
   *
   * The `error` event is emitted when the program inside this space throws an Error.
   *
   * The `rejection` event is emitted when the program inside this space occurs an unhandled promise rejection.
   */
  on(type: "message", messageListener: MessageListener): this;
  on(type: "error", errorListener: ErrorListener): this;
  on(type: "rejection", rejectionListener: RejectionListener): this;
}

export type MessageListener = (message: unknown) => void;
export type ErrorListener = (error: unknown) => void;
export type RejectionListener = (reason: unknown) => void;
