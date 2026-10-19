// Hackathon-only simulator. Nothing here broadcasts video or charges money.
export type Broadcast = { id: string; alias: string; title: string; description: string; sport: string; scheduledAt: string; state: string; hasRecap: boolean; access: string };
const key = 'matchwatch-stream-hackathon-v1';
function seeds(): Broadcast[] {
  const time = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
  return [
    { id: 'demo-courtside', alias: 'Courtside Collective', title: 'Downtown Hoopers vs Eastside Five', sport: 'Basketball', scheduledAt: time(-1), state: 'LIVE', hasRecap: false, access: 'MATCH', description: 'Demo community basketball broadcast. The player uses sample footage for the hackathon, not a real match.' },
    { id: 'demo-soccer', alias: 'Touchline TV', title: 'Houston United vs Austin Athletic', sport: 'Soccer', scheduledAt: time(-.5), state: 'LIVE', hasRecap: false, access: 'FREE', description: 'A sample fan-led soccer channel. All teams, schedules, and broadcast states in this demo are illustrative.' },
    { id: 'demo-baseball', alias: 'Ballpark Stories', title: 'Bayou Bears vs Riverside Nine', sport: 'Baseball', scheduledAt: time(3), state: 'SCHEDULED', hasRecap: false, access: 'CHANNEL', description: 'An upcoming demo game. Open the creator studio to rehearse the broadcast workflow.' },
    { id: 'demo-soccer-recap', alias: 'Touchline TV', title: 'Sunday soccer · match recap', sport: 'Soccer', scheduledAt: time(-24), state: 'ENDED', hasRecap: true, access: 'FREE', description: 'Example past-game recap. Playback is sample film footage, not a recording of this fixture.' },
    { id: 'demo-basketball-recap', alias: 'Courtside Collective', title: 'Friday night · the final quarter', sport: 'Basketball', scheduledAt: time(-48), state: 'ENDED', hasRecap: true, access: 'MATCH', description: 'Example replay with a simulated single-match purchase. No payment is taken.' },
    { id: 'demo-baseball-recap', alias: 'Ballpark Stories', title: 'A day at the diamond · replay', sport: 'Baseball', scheduledAt: time(-72), state: 'ENDED', hasRecap: true, access: 'CHANNEL', description: 'Example recording included in a simulated channel subscription.' },
  ];
}
export function readDemo(): Broadcast[] {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (Array.isArray(saved) && saved.every((row) => row && typeof row.id === 'string' && typeof row.title === 'string' && typeof row.scheduledAt === 'string')) return saved;
  } catch { /* Use clean examples if this browser's saved demo was damaged. */ }
  return seeds();
}
function writeDemo(items: Broadcast[]) { localStorage.setItem(key, JSON.stringify(items)); }
export function resetDemo() { localStorage.removeItem(key); localStorage.removeItem(`${key}-passes`); }
export function hasDemoPass(item: Broadcast) {
  if (item.access === 'FREE') return true;
  try { const passes = JSON.parse(localStorage.getItem(`${key}-passes`) || '[]'); return passes.includes(item.id) || passes.includes(`channel:${item.alias}`); } catch { return false; }
}
export function grantDemoPass(item: Broadcast, subscription: boolean) {
  let passes: string[] = [];
  try { passes = JSON.parse(localStorage.getItem(`${key}-passes`) || '[]'); } catch { /* Reset invalid local demo data. */ }
  if (!Array.isArray(passes)) passes = [];
  passes.push(subscription ? `channel:${item.alias}` : item.id);
  localStorage.setItem(`${key}-passes`, JSON.stringify(passes));
}
export const demoApi = {
  async get<T>(path: string): Promise<{ data: T }> {
    if (path === '/streams/config') return { data: { videoReady: true } as T };
    const items = readDemo();
    if (path === '/streams' || path === '/streams/mine') return { data: items as T };
    const row = items.find((item) => item.id === path.split('/').pop());
    if (!row) throw new Error('This demo broadcast is not saved in this browser. Try one of the sample games.');
    return { data: row as T };
  },
  async post<T>(path: string, payload?: unknown): Promise<{ data: T }> {
    const items = readDemo();
    if (path === '/streams') {
      const input = payload as { title: string; alias: string; sport: string; description: string; scheduledAt: string; rightsConfirmed: boolean; access: string };
      if (!input.rightsConfirmed || !input.title?.trim() || !input.alias?.trim() || !Number.isFinite(Date.parse(input.scheduledAt))) throw new Error('Check your game details and broadcasting permission.');
      const item: Broadcast = { id: `demo-${crypto.randomUUID()}`, title: input.title.trim(), alias: input.alias.trim(), sport: input.sport, description: input.description, scheduledAt: input.scheduledAt, access: input.access, state: 'SCHEDULED', hasRecap: false };
      writeDemo([item, ...items]); return { data: item as T };
    }
    const parts = path.split('/'); const action = parts.pop(); const id = parts.pop();
    const item = items.find((row) => row.id === id);
    if (!item) throw new Error('Demo broadcast not found.');
    if (action === 'play') {
      if (!hasDemoPass(item)) throw new Error('Choose a demo watch pass first. No real payment is taken.');
      if (item.state === 'SCHEDULED') throw new Error('This demo game has not started yet. Start it in the creator studio.');
      return { data: { playerUrl: '/stream-demo-video' } as T };
    }
    if (action === 'connect' || action === 'refresh') item.state = 'LIVE';
    if (action === 'end') item.state = 'ENDED';
    if (action === 'recap') { if (item.state !== 'ENDED') throw new Error('End the demo broadcast first.'); item.hasRecap = true; }
    writeDemo(items);
    return { data: item as T };
  },
};
