import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightResponse, uploadHighlight } from './highlight-request';

test('upload failures remain actionable even when a proxy returns HTML', async () => {
  for (const [status, expected] of [[401, /Sign in/], [413, /too large/], [502, /temporarily unavailable/], [504, /temporarily unavailable/]] as const) {
    await assert.rejects(() => highlightResponse(new Response('<html>Error</html>', { status })), expected);
  }
});
test('provider errors are preserved and successful video responses remain unconsumed', async () => {
  await assert.rejects(() => highlightResponse(Response.json({ error: 'Index is not ready.' }, { status: 409 })), /Index is not ready/);
  const response = new Response('mp4 bytes');
  assert.equal(await highlightResponse(response), response);
  assert.equal(await response.text(), 'mp4 bytes');
});

test('upload progress, provider failures, cancellation and timeout stay observable', async () => {
  const previous = globalThis.XMLHttpRequest;
  class Upload {
    static current: Upload;
    upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
    status = 201; responseText = '{"assetId":"ticket"}'; timeout = 0; aborts = 0;
    onload?: () => void; onerror?: () => void; onabort?: () => void; ontimeout?: () => void;
    constructor() { Upload.current = this; }
    open() {} setRequestHeader() {} send() {}
    getResponseHeader() { return 'application/json'; }
    abort() { this.aborts++; this.onabort?.(); }
  }
  globalThis.XMLHttpRequest = Upload as unknown as typeof XMLHttpRequest;
  try {
    const controller = new AbortController(), updates: number[] = [];
    const done = uploadHighlight('/upload', new FormData(), {}, controller.signal, (sent, total) => updates.push(sent / total));
    const xhr = Upload.current;
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    xhr.onload?.();
    assert.deepEqual(await (await done).json(), { assetId: 'ticket' });
    assert.deepEqual(updates, [0.5]);
    controller.abort(); assert.equal(xhr.aborts, 0, 'finished requests remove abort listeners');

    const canceled = new AbortController();
    const cancellation = uploadHighlight('/upload', new FormData(), {}, canceled.signal, () => {});
    canceled.abort();
    await assert.rejects(cancellation, { name: 'AbortError' });
    const timedOut = uploadHighlight('/upload', new FormData(), {}, new AbortController().signal, () => {});
    Upload.current.ontimeout?.();
    await assert.rejects(timedOut, /five minutes/);
    const rejected = uploadHighlight('/upload', new FormData(), {}, new AbortController().signal, () => {});
    Upload.current.status = 413; Upload.current.responseText = '<html>Too large</html>'; Upload.current.onload?.();
    await assert.rejects(rejected, /too large/);
  } finally {
    globalThis.XMLHttpRequest = previous;
  }
});
