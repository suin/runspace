// This is a keep-going listener of the event system.
process.on("message", (code) => {
  process.send(eval(code));
});

// Explicit exit on SIGTERM is necessary for ThreadSpace that has a keep-going event listener.
process.on("SIGTERM", () => {
  process.exit();
});
