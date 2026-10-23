import { highlightAuthorization, highlightFetch } from '../highlight-session';
import { highlightResponse, uploadHighlight } from '../highlight-request';
import type { KeyMomentsOutput } from './output';
import type { HighlightPreferences, Job, MatchInput } from './types';

// Browser client for the highlight API. Every call goes through the shared
// MatchWatch session so production requests carry the signed-in user's token.

const base = process.env.NEXT_PUBLIC_APP_BASE_PATH || '';
const endpoints = { status: `${base}/api/stream/highlights`, library: `${base}/api/stream/highlights/library`, pipeline: `${base}/api/stream/pipeline` };

export type ServiceStatus = { analysisReady: boolean; renderReady: boolean; socialReady: boolean; requiresLogin: boolean };
export type LibraryItem = {
  ticket: string;
  name: string;
  duration: number;
  thumbnail: string | null;
  playbackUrl: string | null;
  scoreplay: { mediaId: string; eventId?: string } | null;
  orientation: 'landscape' | 'portrait';
};
export type SourceChoice =
  | { kind: 'library'; video: LibraryItem }
  | { kind: 'upload'; file: File }
  | { kind: 'hls'; url: string; seconds: number };
export type JobView = {
  job: Job;
  source: { name: string; kind: string; duration: number; playbackUrl: string | null; scoreplay: { mediaId: string } | null } | null;
  social: { status: string; posts: number; reason: string | null; hashtags: { tag: string; count: number }[] } | null;
  output: KeyMomentsOutput | null;
};

async function json<T>(response: Promise<Response>): Promise<T> {
  return (await highlightResponse(await response)).json();
}

export const fetchStatus = (signal?: AbortSignal) => json<ServiceStatus>(fetch(endpoints.status, { cache: 'no-store', signal }));

export const fetchLibrary = (refresh = false) =>
  json<{ videos: LibraryItem[] }>(highlightFetch(`${endpoints.library}${refresh ? '?refresh=true' : ''}`, { cache: 'no-store' })).then(data => data.videos);

export const fetchJobs = () => json<{ jobs: Job[] }>(highlightFetch(endpoints.pipeline, { cache: 'no-store' })).then(data => data.jobs);

export const fetchJob = (jobId: string, signal?: AbortSignal) =>
  json<JobView>(highlightFetch(`${endpoints.pipeline}?jobId=${encodeURIComponent(jobId)}`, { cache: 'no-store', signal }));

export async function createJob(choice: SourceChoice, match: Omit<MatchInput, 'matchId'>, preferences: HighlightPreferences,
  signal: AbortSignal, onUpload: (percent: number) => void): Promise<Job> {
  const source = choice.kind === 'library' ? { kind: 'library', ticket: choice.video.ticket }
    : choice.kind === 'upload' ? { kind: 'upload', name: choice.file.name }
    : { kind: 'hls', hlsUrl: choice.url || undefined, captureSeconds: choice.seconds };
  const form = new FormData();
  form.set('input', JSON.stringify({ match, preferences, source }));
  if (choice.kind === 'upload') form.set('video', choice.file);
  const response = await uploadHighlight(endpoints.pipeline, form, await highlightAuthorization(), signal,
    (sent, total) => onUpload(Math.min(100, Math.round((sent / total) * 100))));
  return (await response.json()).job;
}

const post = <T>(url: string, body: unknown, signal?: AbortSignal) =>
  highlightFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }).then(response => json<T>(Promise.resolve(response)));

export const advanceJob = (jobId: string, signal?: AbortSignal) => post<{ job: Job }>(endpoints.pipeline, { jobId }, signal).then(data => data.job);

export const rescoreJob = (jobId: string, preferences: HighlightPreferences) => post<{ job: Job }>(endpoints.pipeline, { jobId, preferences }).then(data => data.job);

export async function renderJob(jobId: string, signal?: AbortSignal) {
  const response = await highlightResponse(await highlightFetch(endpoints.status, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId }), signal }));
  return URL.createObjectURL(await response.blob());
}

export function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
