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
  describe("stop", () => {
    it("stops the program", async () => {
      const space = createSpace(fixtures.stopsNever, options);
      await space.start();
      expect(space.isRunning).toBe(true);
      await space.stop();
      expect(space.isRunning).toBe(false);
    });

    it("can be called even if the program already stopped", async () => {
      const space = createSpace(fixtures.stopsNever, options);
      await space.start();
      expect(space.isRunning).toBe(true);
      await space.stop();
      expect(space.isRunning).toBe(false);
      await space.stop(); // second stop must not occur any error
      expect(space.isRunning).toBe(false);
    });

    it("returns Promise<void>", async () => {
      const space = createSpace(fixtures.stopsNever, options);
      await space.start();
      const result = await space.stop();
      expect(result).toBe(undefined);
    });

    it("can be called before the space starts", async () => {
      const space = createSpace(fixtures.stopsNever, options);
      await space.stop();
      expect(space.isRunning).toBe(false);
    });
  });

  describe("waitStop", () => {
    it("waits for that the immediately-stop program stops", async () => {
      const space = createSpace(fixtures.stopsImmediately, options);
      await space.start();
      expect(space.isRunning).toBe(true);
      await space.waitStop();
      expect(space.isRunning).toBe(false);
    });

    it("patiently waits for that the long-lived program stops", async () => {
      const space = createSpace(fixtures.stopsIn500milliseconds, options);
      await space.start();
      expect(space.isRunning).toBe(true);
      const waitOneSecond = setTimeout(() => fail("Too fast to finish"), 1000);
      await space.waitStop();
      clearTimeout(waitOneSecond);
      expect(space.isRunning).toBe(false);
    });

    it("waits the program that has already stopped", async () => {
      const space = createSpace(fixtures.stopsImmediately, options);
      await space.start();
      expect(space.isRunning).toBe(true);
      await space.waitStop();
      expect(space.isRunning).toBe(false);
      await space.waitStop();
      expect(space.isRunning).toBe(false);
    });

    it("waits the program that has already been stopped", async () => {
      const space = createSpace(fixtures.stopsNever, options);
      await space.start();
      expect(space.isRunning).toBe(true);
      await space.stop();
      expect(space.isRunning).toBe(false);
      await space.waitStop();
      expect(space.isRunning).toBe(false);
    });

    it("returns Promise<void>", async () => {
      const space = createSpace(fixtures.stopsImmediately, options);
      await space.start();
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

      await space.start();
      space.send("hello!");

      async function onMessage(message: unknown) {
        await space.waitStop();
        expect(message).toBe("hello!");
        end();
      }
    });

    it("returns void", async () => {
      const space = createSpace(fixtures.echoMessage, options);
      await space.start();
      const result = space.send("hello!");
      expect(result).toBe(undefined);
    });
  });

  describe("event: message", () => {
    it("is fired when the program sends a message", async (end) => {
      const space = createSpace(fixtures.sendsHello, options);
      space.on("message", onMessage);
      shouldNotReceiveError(space);
      shouldNotReceivePromiseRejection(space);
      await space.start();

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
      await space.start();
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
      await space.start();

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
      await space.start();

      async function onError(error: unknown) {
        await space.waitStop();
        expect(error).toContain("This string was thrown by");
        end();
      }
    });

    it("is fired when the program throws a custom error object", async (end) => {
      const space = createSpace(fixtures.throwsCustomError, options);
      space.on("error", onError);
      shouldNotReceiveMessage(space);
      shouldNotReceivePromiseRejection(space);
      await space.start();

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
      await space.start();

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
      await space.start();

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
