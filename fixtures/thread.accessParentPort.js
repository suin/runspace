const { parentPort } = require("worker_threads");

process.send(parentPort === null);
