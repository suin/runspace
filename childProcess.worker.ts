import { Serializable } from "child_process";
import { Env } from "./childProcess";
import { SystemMessageContainer } from "./systemMessage";

startWorker({ process });

function startWorker({
  process,
}: {
  readonly process: Pick<NodeJS.Process, "env" | "on" | "send">;
}): void {
  if (!Env.isEnv(process.env)) {
    throw new Error(`Given environment variables don't satisfy Env interface`);
  }

  if (!processSendIsCallable(process)) {
    throw new Error(`The process.end must be callable`);
  }

  const filename = Env.getFilename(process.env);
  hideEnvironmentVariablesFromUntrustedProgram(process.env);

  process.on("uncaughtException", (error) =>
    process.send(
      SystemMessageContainer.error(convertErrorLikeToSerializable(error))
    )
  );

  process.on("unhandledRejection", (reason) =>
    process.send(
      SystemMessageContainer.unhandledRejection(
        convertErrorLikeToSerializable(reason)
      )
    )
  );

  require(filename);
}

function hideEnvironmentVariablesFromUntrustedProgram(env: Env) {
  Env.dropVariables(env);
}

function convertErrorLikeToSerializable(errorLike: unknown): Serializable {
  if (errorLike instanceof Error) {
    const { name, message, stack, ...extraOwnProperties } = errorLike;
    return { name, message, stack, ...extraOwnProperties };
  } else {
    return errorLike as Serializable;
  }
}

function processSendIsCallable(
  process: Pick<NodeJS.Process, "send">
): process is Required<Pick<NodeJS.Process, "send">> {
  return typeof process.send === "function";
}
