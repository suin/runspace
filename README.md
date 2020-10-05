# @suin/runspace

Isolated execution context for Node.js.

## Usage

```typescript
// main.js
import { ThreadSpace, ChildProcessSpace } from "@suin/runspace";

const space = new ThreadSpace({ filename: "./target.js" }) // Or new ChildProcessSpace({ filename: "./target.js" })
  .on("message", (message) => console.log(message))
  .on("error", (error) => console.error(error))
  .on("rejection", (reason) => console.error(reason));

await space.start();
space.send("Hello");
await space.stop();

// target.js
process.on("message", (message) => {
  process.send(message + " World");
});

// Output:
// "Hello World"
```
