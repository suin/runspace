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
