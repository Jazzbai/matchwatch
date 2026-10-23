import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePlayMediaId } from './scoreplay-link';

test('a shared ScorePlay media page and its numeric ID select the same asset', () => {
  assert.equal(scorePlayMediaId('https://spurs2-hack-17.scoreplay.io/media/media-details/130852725?filename_query=full%20match'), '130852725');
  assert.equal(scorePlayMediaId(' 130852725 '), '130852725');
  assert.equal(scorePlayMediaId('https://spurs2-hack-17.scoreplay.io/media/media-details/130852725/'), '130852725');
});

test('only supported media page links or valid media IDs are accepted', () => {
  for (const value of ['', '0', '-1', '12345678901234567', '../130852725', 'https://scoreplay.io.attacker.test/media/media-details/130852725', 'https://attacker-scoreplay.io/media/media-details/130852725', 'http://spurs2-hack-17.scoreplay.io/media/media-details/130852725', 'https://user:secret@spurs2-hack-17.scoreplay.io/media/media-details/130852725', 'https://spurs2-hack-17.scoreplay.io:8000/media/media-details/130852725', 'https://spurs2-hack-17.scoreplay.io/media/media-details/130852725/other', 'https://spurs2-hack-17.scoreplay.io/?mediaId=130852725']) {
    assert.equal(scorePlayMediaId(value), null, value);
  }
});
