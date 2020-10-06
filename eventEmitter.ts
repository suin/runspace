import { TypedEventEmitter } from "@suin/typed-event-emitter";
import { EventEmitter } from "events";
import {
  ErrorListener,
  MessageListener,
  RejectionListener,
  WaitMessagePredicate,
} from "./index";

type SpaceEventEmitter = TypedEventEmitter<{
  message: MessageListener;
  error: ErrorListener;
  rejection: RejectionListener;
}>;

export const createEventEmitter = () => new EventEmitter() as SpaceEventEmitter;

export const waitMessage = (
  events: SpaceEventEmitter,
  predicate: WaitMessagePredicate
): Promise<void> =>
  new Promise((resolve) => {
    const messageListener: MessageListener = (message) => {
      if (predicate(message)) {
        events.off("message", messageListener);
        resolve();
      }
    };
    events.on("message", messageListener);
  });
