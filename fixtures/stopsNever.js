// Explicit exit on SIGTERM is necessary for ThreadSpace
process.on("SIGTERM", () => {
  process.exit();
});

// this worker program never stops until the worker manager stops this.
setInterval(() => {
  // I'm still live!
}, 1000);
