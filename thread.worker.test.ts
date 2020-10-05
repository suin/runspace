import { ThreadSpace } from ".";
import * as fixtures from "./fixtures";

describe("thread.worker.js", () => {
  it("hides the workerData from the workerProgram", async (end) => {
    const space = new ThreadSpace({
      filename: fixtures.threadAccessWorkerData,
    });
    space.on("message", onMessage);
    await space.start();

    async function onMessage(workerData: unknown) {
      await space.waitStop();
      expect(workerData).toBe(null);
      end();
    }
  });

  it("hides the parentPort from the workerProgram", async (end) => {
    const space = new ThreadSpace({
      filename: fixtures.threadAccessParentPort,
    });
    space.on("message", onMessage);
    await space.start();

    async function onMessage(isParentPortNull: unknown) {
      await space.waitStop();
      expect(isParentPortNull).toBe(true);
      end();
    }
  });
});
