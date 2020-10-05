import { TypedEventEmitter } from "@suin/typed-event-emitter";
import { EventEmitter } from "events";
import { ErrorListener, MessageListener, RejectionListener } from "./index";

export const createEventEmitter = () =>
  new EventEmitter() as TypedEventEmitter<{
    message: MessageListener;
    error: ErrorListener;
    rejection: RejectionListener;
  }>;
