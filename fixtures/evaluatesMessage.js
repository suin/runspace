process.on("message", (code) => {
  process.send(eval(code));
});
