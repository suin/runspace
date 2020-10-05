const { workerData } = require("worker_threads");

process.send(workerData);
