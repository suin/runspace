import { isObject } from "@suin/is-object";
import workerThreads, { MessagePort } from "worker_threads";
import { MessageListener } from "./index";
import { SystemMessageContainer } from "./systemMessage";
import { WorkerData } from "./thread";

startWorker({ workerThreads, process });

function startWorker({
  workerThreads,
  process,
}: {
  workerThreads: {
    parentPort: MessagePort | null;
    isMainThread: boolean;
    workerData: unknown;
  };
  process: NodeJS.Process;
}): void {
  const { parentPort, isMainThread, workerData } = workerThreads;

  if (isMainThread) {
    throw new Error("This program must run inside a thread");
  }

  if (!isObject(parentPort)) {
    throw new Error("parentPort must be type object");
  }

  if (!WorkerData.is(workerData)) {
    throw new Error("Given workerData is not a type WorkerData");
  }

  hideWorkerDataFromUntrustedProgram(workerThreads);
  hideParentPortFromUntrustedProgram(workerThreads);
  bypassMessagesFromMainThreadToProcessEvents(parentPort, process);

  process.send = (message: unknown): boolean => {
    parentPort.postMessage(message);
    return true;
  };

  process.on("unhandledRejection", (reason) =>
    parentPort.postMessage(SystemMessageContainer.unhandledRejection(reason))
  );

  require(workerData.filename);
}

function hideWorkerDataFromUntrustedProgram(module: {
  workerData: typeof workerThreads.workerData;
}) {
  module.workerData = null;
}

function hideParentPortFromUntrustedProgram(module: {
  parentPort: typeof workerThreads.parentPort;
}) {
  module.parentPort = null;
}

function bypassMessagesFromMainThreadToProcessEvents(
  parentPort: Pick<MessagePort, "on" | "off">,
  process: NodeJS.Process
) {
  // This code allows the in-thread program to receive messages from the main thread by using `process.on('message')`.
  //
  // Thinking simply, we can bypass the messages with the following code, but there is a problem with this:
  //
  // ```js
  // parentPort.on("message", (message) => process.emit("message", message));
  // ```
  //
  // Once we register an event listener with `parentPort.on('message')`, the thread program becomes to not terminate until we cancel the event listener or call `process.exit`.
  // This is fine for threaded programs that intend to receive messages from the main thread.
  // On the other hand, threading programs that don't need to receive messages from the main thread becomes to have to explicitly call `process.exit`. This is a bit painful for such programs.
  //
  // To solve this problem, this code calls `parentPort.on('message')` only when the threading program needs a message from the main thread.
  process
    .on("newListener", onNewListener)
    .on("removeListener", onRemoveListener);

  const map = new Map<
    NodeJS.NewListenerListener | NodeJS.RemoveListenerListener,
    MessageListener
  >();

  function onNewListener(
    type: string,
    listener: NodeJS.NewListenerListener
  ): void {
    if (type === "message") {
      const bypass: MessageListener = (message) =>
        void process.emit("message", message, undefined);
      map.set(listener, bypass);
      parentPort.on("message", bypass);
    }
  }

  function onRemoveListener(
    type: string,
    listener: NodeJS.RemoveListenerListener
  ): void {
    if (type === "message") {
      const bypass = map.get(listener);
      if (bypass) {
        parentPort.off("message", bypass);
      }
    }
  }
}
