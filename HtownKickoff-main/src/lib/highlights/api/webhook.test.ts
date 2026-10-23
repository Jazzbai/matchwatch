import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliverWebhook, deliveryId, signature, type Sender, type WebhookPayload } from './webhook';

const payload: WebhookPayload = { event: 'job.completed', job_id: 'job-1', video_id: '42', status: 'completed', result: { highlights: [] } };
const url = 'https://hooks.example.com/matchwatch';
const publicDns = async () => ['93.184.216.34'];
const quiet = { sleep: async () => {}, log: () => {} };

function recorder(statuses: (number | Error)[]) {
  const calls: { address: string; body: string; headers: Record<string, string> }[] = [];
  const sender: Sender = async (_url, address, body, headers) => {
    calls.push({ address, body, headers });
    const next = statuses[calls.length - 1];
    if (next instanceof Error) throw next;
    return next;
  };
  return { calls, sender };
}

test('delivers once with a stable delivery ID and a verifiable signature', async () => {
  const { calls, sender } = recorder([200]);
  const result = await deliverWebhook(url, payload, { ...quiet, sender, resolve: publicDns, secret: 'test-secret' });
  assert.equal(result.delivered, true);
  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.equal(call.address, '93.184.216.34', 'the connection is pinned to the checked address');
  assert.equal(call.headers['X-Webhook-Id'], deliveryId(payload));
  assert.equal(call.headers['X-Webhook-Signature'], signature('test-secret', call.headers['X-Webhook-Timestamp'], call.body));
  assert.deepEqual(JSON.parse(call.body), { delivery_id: deliveryId(payload), ...payload });
  assert.equal(deliveryId(payload), deliveryId({ ...payload }), 'retries and re-sends reuse the same ID');
});

test('retries network errors, 429 and 5xx with exponential backoff', async () => {
  const delays: number[] = [];
  const { calls, sender } = recorder([new Error('reset'), 503, 429, 204]);
  const result = await deliverWebhook(url, payload, { sender, resolve: publicDns, log: () => {}, sleep: async ms => { delays.push(ms); } });
  assert.equal(result.delivered, true);
  assert.equal(calls.length, 4);
  assert.deepEqual(delays, [1000, 2000, 4000]);
  assert.equal(result.attempts[0].error, 'reset');
});

test('stops after the attempt limit, and does not retry client errors or follow redirects', async () => {
  const exhausted = recorder([500, 500, 500, 500, 500]);
  assert.equal((await deliverWebhook(url, payload, { ...quiet, sender: exhausted.sender, resolve: publicDns })).delivered, false);
  assert.equal(exhausted.calls.length, 4);
  const rejected = recorder([400]);
  assert.equal((await deliverWebhook(url, payload, { ...quiet, sender: rejected.sender, resolve: publicDns })).delivered, false);
  assert.equal(rejected.calls.length, 1);
  const redirected = recorder([302]);
  const result = await deliverWebhook(url, payload, { ...quiet, sender: redirected.sender, resolve: publicDns });
  assert.equal(result.delivered, false);
  assert.equal(redirected.calls.length, 1);
  assert.match(result.attempts[0].error!, /Redirects/);
});

test('never sends to hosts that resolve to private or reserved addresses', async () => {
  for (const addresses of [['127.0.0.1'], ['10.1.2.3'], ['169.254.169.254'], ['93.184.216.34', '192.168.1.10'], []]) {
    const { calls, sender } = recorder([200]);
    const result = await deliverWebhook(url, payload, { ...quiet, sender, resolve: async () => addresses });
    assert.equal(result.delivered, false, addresses.join(','));
    assert.equal(calls.length, 0);
  }
  const { calls, sender } = recorder([200]);
  assert.equal((await deliverWebhook('http://hooks.example.com', payload, { ...quiet, sender, resolve: publicDns })).delivered, false);
  assert.equal(calls.length, 0);
});
