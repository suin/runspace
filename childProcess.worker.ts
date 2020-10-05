import { Serializable } from "child_process";
import { SystemMessageContainer } from "./systemMessage";

const { RUNSPACE_FILENAME: filename } = process.env;
hideEnvironmentVariablesFromUntrustedProgram();

process.on("uncaughtException", (error: unknown) =>
  process.send!(
    SystemMessageContainer.error(convertErrorLikeToSerializable(error))
  )
);

process.on("unhandledRejection", (reason: unknown) =>
  process.send!(
    SystemMessageContainer.unhandledRejection(
      convertErrorLikeToSerializable(reason)
    )
  )
);

require(filename!);

function hideEnvironmentVariablesFromUntrustedProgram() {
  delete process.env.RUNSPACE_FILENAME;
}

function convertErrorLikeToSerializable(errorLike: unknown): Serializable {
  if (errorLike instanceof Error) {
    const { name, message, stack, ...extraOwnProperties } = errorLike;
    return { name, message, stack, ...extraOwnProperties };
  } else {
    return errorLike as Serializable;
  }
}
