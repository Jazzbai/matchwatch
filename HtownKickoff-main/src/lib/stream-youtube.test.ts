import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findYoutubeVideos, youtubeQuery } from './stream-youtube';
test('search requests embeddable videos and excludes invalid identifiers', async () => {
  let requested = '';
  const mock = (async (url: string | URL | Request) => {
    requested = String(url);
    return new Response(JSON.stringify({ items: [
      { id: { videoId: 'abcdefghijk' }, snippet: { title: 'A &amp; B recap', channelTitle: 'Sports &quot;Channel&quot;' } },
      { id: { videoId: 'unsafe/path' }, snippet: { title: 'Invalid' } },
    ] }));
  }) as typeof fetch;
  const videos = await findYoutubeVideos('test-key-only', 'Basketball', 'recaps', mock);
  const url = new URL(requested);
  assert.equal(url.searchParams.get('videoEmbeddable'), 'true');
  assert.equal(url.searchParams.get('videoSyndicated'), 'true');
  assert.equal(videos.length, 1);
  assert.equal(videos[0].title, 'A & B recap');
  assert.equal(videos[0].channel, 'Sports "Channel"');
  assert.equal(JSON.stringify(videos).includes('test-key-only'), false);
  assert.match(youtubeQuery('Soccer', 'past'), /full game replay/);
});
test('provider errors never expose the key or provider response', async () => {
  const mock = (async () => new Response('private error detail', { status: 403 })) as typeof fetch;
  await assert.rejects(findYoutubeVideos('test-key-only', 'Baseball', 'past', mock), { message: 'YOUTUBE_ACCESS' });
});
