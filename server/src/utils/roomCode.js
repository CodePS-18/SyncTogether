export function makeRoomCode() {
  return `SYNC-${Math.floor(1000 + Math.random() * 9000)}`;
}
