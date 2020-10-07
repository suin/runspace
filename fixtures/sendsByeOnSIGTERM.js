process.on("SIGTERM", () => {
  process.send("Bye");
  process.exit();
});
process.send("Ready");
setTimeout(() => {}, 10000);
