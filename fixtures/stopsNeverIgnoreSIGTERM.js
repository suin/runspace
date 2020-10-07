// this worker program never stops and ignores SIGTERM!
setInterval(() => {
  // I'm still live!
}, 20000);

process.on("SIGTERM", () => {
  // Ignore!!
});

process.send("Ready");
