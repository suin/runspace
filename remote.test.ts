import WebSocket from "ws";
import * as fixtures from "./fixtures";
import { RemoteSpace, Start, Stop } from "./remote";

describe("RemoteSpace", () => {
  test("proof of concept", async (end) => {
    const server = await startRemoteServer(() => {
      require(fixtures.echoMessage);
    });

    const space = new RemoteSpace({ url: "ws://localhost:8080" });
    await space.waitStart();
    space.send("Hello");
    await space.waitMessage((reply) => reply === "Hello");
    await space.stop();

    server.close();
    end();
  });
});

async function startRemoteServer(program: Function): Promise<WebSocket.Server> {
  const wss = new WebSocket.Server({ port: 8080 });
  const originalSend = process.send;

  wss
    .on("connection", function connection(ws) {
      process.send = (message) => {
        ws.send(JSON.stringify(message));
        return true;
      };

      ws.on("message", function incoming(data) {
        const message = data.toString();
        if (Start.isStart(message)) {
          program();
          ws.send(message);
          return;
        }
        if (Stop.isStop(message)) {
          ws.send(message);
          ws.close(1000);
          ws.terminate();
          return;
        }
        process.emit("message", JSON.parse(message), undefined);
      });
    })
    .on("close", () => {
      // restore
      process.send = originalSend;
    });

  return wss;
}
