async function main() {
  throw new Error("This rejection was thrown by fixture");
}
// noinspection JSIgnoredPromiseFromCall
main();
