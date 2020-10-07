import compareVersions from "compare-versions";
import { PassThrough } from "stream";
import { ChildProcessSpace, Space, ThreadSpace } from ".";
import * as fixtures from "./fixtures";

const types: ReadonlyArray<[CreateSpaceOptions["type"], CreateSpaceOptions]> = [
  ["thread", { type: "thread" }],
  ["childProcess", { type: "childProcess" }],
];

const createSpace = (filename: string, options: CreateSpaceOptions): Space => {
  switch (options.type) {
    case "thread":
      return new ThreadSpace({ filename });
    case "childProcess":
      return new ChildProcessSpace({ filename });
  }
};

type CreateSpaceOptions = ThreadSpaceOptions | ChildProcessSpaceOptions;
type ThreadSpaceOptions = {
  readonly type: "thread";
};
type ChildProcessSpaceOptions = {
  readonly type: "childProcess";
};

describe.each(types)("Space(%s)", (type, options) => {
  describe("stdout", () => {
    it("represents space's stdout", async () => {
      const stdout = new PassThrough();
      const space = createSpace(fixtures.stdoutHello, options);
      space.stdout.unpipe(process.stdout);
      space.stdout.pipe(stdout);
      await space.waitStart();
      await space.waitStop();
      let output = "";
      for await (const chunk of stdout) {
        output += chunk;
      }
      expect(output).toBe("Hello");
    });
  });

  describe("stop", () => {
    it("stops the program", async () => {
      const space = createSpace(fixtures.stopsNever, options);
      await space.waitStart();
      expect(space.isRunning).toBe(true);
      await space.stop();
      expect(space.isRunning).toBe(false);
    });

    it("can be called even if the program already stopped", async () => {
      const space = createSpace(fixtures.stopsNever, options);
      await space.waitStart();
      expect(space.isRunning).toBe(true);
      await space.stop();
      expect(space.isRunning).toBe(false);
      await space.stop(); // second stop must not occur any error
      expect(space.isRunning).toBe(false);
    });

    it("returns Promise<void>", async () => {
      const space = createSpace(fixtures.stopsNever, options);
      await space.waitStart();
      const result = await space.stop();
      expect(result).toBe(undefined);
    });

    it("can be called before the space starts", async () => {
      const space = createSpace(fixtures.stopsNever, options);
      await space.stop();
      expect(space.isRunning).toBe(false);
    });

    it("sends SIGTERM to the space", async (end) => {
      const space = createSpace(fixtures.sendsByeOnSIGTERM, options);
      await space.waitMessage((message) => message === "Ready");
      await Promise.all([
        space.stop(),
        space.waitMessage((message) => message === "Bye"),
      ]);
      end();
    });

    it("sends SIGKILL to the space or forcibly terminates the space after 10 seconds", async (end) => {
      const space = createSpace(fixtures.stopsNeverIgnoreSIGTERM, options);
      await space.waitMessage((message) => message === "Ready");
      await space.stop();
      end();
    }, 11000);
  });

  describe("waitStop", () => {
    it("waits for that the immediately-stop program stops", async () => {
      const space = createSpace(fixtures.stopsImmediately, options);
      await space.waitStart();
      expect(space.isRunning).toBe(true);
      await space.waitStop();
      expect(space.isRunning).toBe(false);
    });

    it("patiently waits for that the long-lived program stops", async () => {
      const space = createSpace(fixtures.stopsIn500milliseconds, options);
      await space.waitStart();
      expect(space.isRunning).toBe(true);
      const waitOneSecond = setTimeout(() => fail("Too fast to finish"), 1000);
      await space.waitStop();
      clearTimeout(waitOneSecond);
      expect(space.isRunning).toBe(false);
    });

    it("waits the program that has already stopped", async () => {
      const space = createSpace(fixtures.stopsImmediately, options);
      await space.waitStart();
      expect(space.isRunning).toBe(true);
      await space.waitStop();
      expect(space.isRunning).toBe(false);
      await space.waitStop();
      expect(space.isRunning).toBe(false);
    });

    it("waits the program that has already been stopped", async () => {
      const space = createSpace(fixtures.stopsNever, options);
      await space.waitStart();
      expect(space.isRunning).toBe(true);
      await space.stop();
      expect(space.isRunning).toBe(false);
      await space.waitStop();
      expect(space.isRunning).toBe(false);
    });

    it("returns Promise<void>", async () => {
      const space = createSpace(fixtures.stopsImmediately, options);
      await space.waitStart();
      const result = await space.waitStop();
      expect(result).toBe(undefined);
    });

    it("can be called before the space starts", async () => {
      const space = createSpace(fixtures.stopsImmediately, options);
      await space.waitStop();
      expect(space.isRunning).toBe(false);
    });
  });

  describe("send", () => {
    it("sends message to the program", async (end) => {
      const space = createSpace(fixtures.echoMessage, options);
      space.on("message", onMessage);
      shouldNotReceiveError(space);
      shouldNotReceivePromiseRejection(space);

      await space.waitStart();
      space.send("hello!");

      async function onMessage(message: unknown) {
        await space.waitStop();
        expect(message).toBe("hello!");
        end();
      }
    });

    it("returns void", async () => {
      const space = createSpace(fixtures.echoMessage, options);
      await space.waitStart();
      const result = space.send("hello!");
      expect(result).toBe(undefined);
    });
  });

  describe("waitMessage", () => {
    it("waits until a message that the predicate returns true", async () => {
      let messageReceived = false;
      const space = createSpace(
        fixtures.sendsHelloIn500milliseconds,
        options
      ).on("message", () => void (messageReceived = true));
      await space.waitStart();
      await space.waitMessage((message) => message === "Hello");
      await space.stop();
      expect(messageReceived).toBe(true);
    });

    it("returns Promise<void>", async () => {
      const space = createSpace(fixtures.sendsHello, options);
      await space.waitStart();
      const result = await space.waitMessage((message) => message === "Hello");
      expect(result).toBe(undefined);
    });

    it("can wait some massages concurrently", async () => {
      let receivedMessageCount = 0;
      const space = createSpace(fixtures.sendsOneTwoThree, options);
      space.on("message", () => void receivedMessageCount++);
      await space.waitStart();
      await Promise.all([
        space.waitMessage((message) => message === 1),
        space.waitMessage((message) => message === 2),
        space.waitMessage((message) => message === 3),
      ]);
      expect(receivedMessageCount).toBe(3);
    });

    it("can be used for request-response communication", async () => {
      const space = createSpace(fixtures.evaluatesMessage, options);
      await space.waitStart();
      space.send(`1 + 1`);
      await space.waitMessage((result) => result === 2);
      space.send(`1 + 2`);
      await space.waitMessage((result) => result === 3);
      space.send(`1 + 3`);
      await space.waitMessage((result) => result === 4);
      await space.stop();
    });
  });

  describe("event: message", () => {
    it("is fired when the program sends a message", async (end) => {
      const space = createSpace(fixtures.sendsHello, options);
      space.on("message", onMessage);
      shouldNotReceiveError(space);
      shouldNotReceivePromiseRejection(space);
      await space.waitStart();

      async function onMessage(message: unknown) {
        await space.waitStop();
        expect(message).toBe("Hello");
        end();
      }
    });
  });

  describe('on("message")', () => {
    it("accepts multiple listeners", async () => {
      const space = createSpace(fixtures.sendsHello, options);
      const twoMessagesPromise = [
        new Promise((resolve) => space.on("message", resolve)),
        new Promise((resolve) => space.on("message", resolve)),
      ];
      await space.waitStart();
      const twoMessages = await Promise.all(twoMessagesPromise);
      expect(twoMessages).toEqual(["Hello", "Hello"]);
    });
  });

  describe("event: error", () => {
    it("is fired when the program throws an Error", async (end) => {
      const space = createSpace(fixtures.throwsError, options);
      space.on("error", onError);
      shouldNotReceiveMessage(space);
      shouldNotReceivePromiseRejection(space);
      await space.waitStart();

      async function onError(error: unknown) {
        await space.waitStop();
        const _error = error as Error;
        expect(_error.message).toBe("This exception was thrown by fixture");
        expect(_error.stack).toContain(`${type}.worker.js`);
        end();
      }
    });

    it("is fired when the program throws a string value", async (end) => {
      const space = createSpace(fixtures.throwsString, options);
      space.on("error", onError);
      shouldNotReceiveMessage(space);
      shouldNotReceivePromiseRejection(space);
      await space.waitStart();

      async function onError(error: unknown) {
        await space.waitStop();
        if (
          type === "thread" &&
          compareVersions.compare(process.versions.node, "14.7.0", ">=")
        ) {
          // Since Node v14.7.0, the behavior of handling uncaught primitive values in worker_threads was changed.
          // For details, see https://github.com/nodejs/node/issues/35506
          const _error = error as Error;
          expect(_error.message).toContain("This string was thrown by");
        } else {
          expect(error).toContain("This string was thrown by");
        }
        end();
      }
    });

    it("is fired when the program throws a custom error object", async (end) => {
      const space = createSpace(fixtures.throwsCustomError, options);
      space.on("error", onError);
      shouldNotReceiveMessage(space);
      shouldNotReceivePromiseRejection(space);
      await space.waitStart();

      async function onError(error: unknown) {
        await space.waitStop();
        const _error = error as Error & { extraProperty: string };
        expect(_error.name).toBe("CustomError");
        expect(_error.extraProperty).toBe("extraProperty");
        end();
      }
    });
  });

  describe("event: rejection", () => {
    it("is fired when the program occurs unhandled promise rejection", async (end) => {
      const space = createSpace(fixtures.unhandledRejection, options);
      space.on("rejection", onRejection);
      shouldNotReceiveMessage(space);
      shouldNotReceiveError(space);
      await space.waitStart();

      async function onRejection(reason: unknown) {
        await space.waitStop();
        const error = reason as Error;
        expect(error.message).toBe("This rejection was thrown by fixture");
        expect(error.stack).toContain(`${type}.worker.js`);
        end();
      }
    });

    it("is fired when the program occurs unhandled promise rejection string", async (end) => {
      const space = createSpace(fixtures.unhandledRejectionString, options);
      space.on("rejection", onRejection);
      shouldNotReceiveMessage(space);
      shouldNotReceiveError(space);
      await space.waitStart();

      async function onRejection(reason: unknown) {
        await space.waitStop();
        expect(reason).toContain("This string rejection was thrown");
        end();
      }
    });
  });
});

function shouldNotReceiveMessage(space: Space): void {
  space.on("message", (message) => {
    fail(`This test should not receive any message: ${message}`);
  });
}

function shouldNotReceiveError(space: Space): void {
  space.on("error", (error) => {
    fail(`This test should not receive errors: ${error}`);
  });
}

function shouldNotReceivePromiseRejection(space: Space): void {
  space.on("rejection", (reason) => {
    fail(`This test should not receive promise rejections: ${reason}`);
  });
}
