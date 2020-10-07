import { isObject } from "@suin/is-object";

/**
 * @internal
 */
export type SystemMessageContainer = {
  readonly __runspace__: SystemMessage;
};

/**
 * @internal
 */
export const SystemMessageContainer = {
  error(error: unknown): SystemMessageContainer {
    return {
      __runspace__: { type: "error", error },
    };
  },
  unhandledRejection(reason: unknown): SystemMessageContainer {
    return {
      __runspace__: { type: "unhandledRejection", reason },
    };
  },
};

type SystemMessage = ErrorMessage | UnhandledRejectionMessage;

type ErrorMessage = {
  readonly type: "error";
  readonly error: unknown;
};

type UnhandledRejectionMessage = {
  readonly type: "unhandledRejection";
  readonly reason: unknown;
};

/**
 * @internal
 */
export const isSystemMessageContainer = (
  message: unknown
): message is SystemMessageContainer =>
  isObject<SystemMessageContainer>(message) &&
  isSystemMessage(message.__runspace__);

const isSystemMessage = (message: unknown): message is SystemMessage =>
  isObject<SystemMessage>(message) &&
  (isErrorMessage(message) || isUnhandledRejectionMessage(message));

const isErrorMessage = (message: unknown): message is ErrorMessage =>
  isObject<ErrorMessage>(message) &&
  message.type === "error" &&
  "error" in message;

const isUnhandledRejectionMessage = (
  message: unknown
): message is UnhandledRejectionMessage =>
  isObject<UnhandledRejectionMessage>(message) &&
  message.type === "unhandledRejection" &&
  "reason" in message;
