import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRoomCode } from '../src/utils/roomCode.js';

test('room code has SYNC-XXXX format', () => {
  const code = makeRoomCode();
  assert.match(code, /^SYNC-\d{4}$/);
});
