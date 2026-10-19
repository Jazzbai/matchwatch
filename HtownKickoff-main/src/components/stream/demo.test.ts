import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoApi, grantDemoPass, hasDemoPass, readDemo, resetDemo, type Broadcast } from './demo';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
} });

test('demo gates paid playback, scopes match passes, and resets access', async () => {
  resetDemo();
  const paid = readDemo().find((item) => item.id === 'demo-courtside')!;
  const replay = readDemo().find((item) => item.id === 'demo-basketball-recap')!;
  await assert.rejects(demoApi.post(`/streams/${paid.id}/play`), /demo watch pass/);
  grantDemoPass(paid, false);
  assert.equal(hasDemoPass(paid), true);
  assert.equal(hasDemoPass(replay), false);
  await assert.doesNotReject(demoApi.post(`/streams/${paid.id}/play`));
  grantDemoPass(paid, true);
  assert.equal(hasDemoPass(replay), true);
  resetDemo();
  assert.equal(hasDemoPass(paid), false);
});

test('scheduled game can go live, end, and publish a recording entry', async () => {
  resetDemo();
  await assert.rejects(demoApi.post('/streams', { title: 'Test game' }), /permission/);
  const { data: created } = await demoApi.post<Broadcast>('/streams', {
    title: 'Local game', alias: 'Test channel', sport: 'Soccer', description: 'Demo only',
    scheduledAt: new Date(Date.now() + 3600000).toISOString(), rightsConfirmed: true, access: 'FREE',
  });
  assert.equal(created.state, 'SCHEDULED');
  await assert.rejects(demoApi.post(`/streams/${created.id}/play`), /not started/);
  await assert.rejects(demoApi.post(`/streams/${created.id}/recap`), /End the demo/);
  await demoApi.post(`/streams/${created.id}/connect`);
  await assert.doesNotReject(demoApi.post(`/streams/${created.id}/play`));
  await demoApi.post(`/streams/${created.id}/end`);
  await demoApi.post(`/streams/${created.id}/recap`);
  const { data } = await demoApi.get<Broadcast>(`/streams/${created.id}`);
  assert.equal(data.state, 'ENDED');
  assert.equal(data.hasRecap, true);
  resetDemo();
});
