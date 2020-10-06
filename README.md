# @suin/runspace

Isolated execution context for Node.js.

## Installation

```shell script
# via NPM
npm install --save @suin/runspace
# via Yarn
yarn add @suin/runspace
```

## Usage

Basic usage:

```javascript
// main.js
const { ThreadSpace, ChildProcessSpace } = require("@suin/runspace");

(async () => {
  const space = new ThreadSpace({ filename: "./target.js" }) // Or new ChildProcessSpace({ filename: "./target.js" })
    .on("message", (message) => console.log(message))
    .on("error", (error) => console.error(error))
    .on("rejection", (reason) => console.error(reason));

  await space.start();
  space.send("Hello");
  await space.waitStop();
})();

// target.js
process.on("message", (message) => {
  process.send(message + " World");
  process.exit();
});

// Output:
// "Hello World"
```

Waits a message from the program inside the space:

```javascript
// target.js
const http = require("http");

const server = http.createServer((req, res) => {
  res.write("OK");
  res.end();
});
server.listen(8000, () => {
  process.send("HTTP_SERVER_READY");
});

// main.js
const { ThreadSpace } = require("@suin/runspace");
const fetch = require("node-fetch");

(async () => {
  const space = new ThreadSpace({ filename: "./target.js" });
  await space.start();
  await space.waitMessage((message) => message === "HTTP_SERVER_READY");
  const res = await fetch("http://localhost:8000");
  const text = await res.text();
  await space.stop();
  console.log(text); // Output: "OK"
})();
```
