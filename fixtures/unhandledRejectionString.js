async function main() {
  throw "This string rejection was thrown by " + __filename;
}
// noinspection JSIgnoredPromiseFromCall
main();
