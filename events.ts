import { TypedEventEmitter } from "@suin/typed-event-emitter";
import events from "events";
import {
  ErrorListener,
  MessageListener,
  RejectionListener,
  WaitMessagePredicate,
} from "./index";

/**
 * @internal
 */
export interface EventEmitter
  extends TypedEventEmitter<{
    message: MessageListener;
    error: ErrorListener;
    rejection: RejectionListener;
  }> {
  waitMessage(predicate: WaitMessagePredicate): Promise<void>;
}

class EventEmitterImpl extends events.EventEmitter {
  waitMessage(
    this: EventEmitter,
    predicate: WaitMessagePredicate
  ): Promise<void> {
    return new Promise((resolve) => {
      const messageListener: MessageListener = (message) => {
        if (predicate(message)) {
          this.off("message", messageListener);
          resolve();
        }
      };
      this.on("message", messageListener);
    });
  }
}

/**
 * @internal
 */
export const EventEmitter = EventEmitterImpl as (new () => EventEmitter) &
  typeof EventEmitterImpl;
