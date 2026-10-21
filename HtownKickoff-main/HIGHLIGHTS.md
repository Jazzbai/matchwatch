# Local highlight studio

On branch `hacketong`, `/stream` is the highlight studio. The previous results browser is available at `/stream/games`; the streaming dashboard remains at `/stream/studio`.

Run `npm install` and `npm run dev` in this directory, then open `/stream` on the printed localhost address. FFmpeg is bundled through `ffmpeg-static`. If your npm settings block install scripts and the executable is missing, run `node node_modules/ffmpeg-static/install.js`.

Upload a recorded video (maximum 200 MB), mark candidate events or run TwelveLabs detection, review their timing and scoring inputs, and generate an MP4. A five-minute maximum target and twenty-clip export limit keep this local prototype bounded. Input and intermediate export files are removed after each export request.

## TwelveLabs

Set these variables in `.env.local` and restart Next.js:

```dotenv
TWELVELABS_API_KEY=your-api-key
TWELVELABS_INDEX_ID=your-marengo-enabled-index-id
# Optional override for the bundled FFmpeg executable:
# FFMPEG_PATH=C:/tools/ffmpeg/bin/ffmpeg.exe
```

Clicking detection uploads the selected video to TwelveLabs. The provider retains its asset and indexed video according to your TwelveLabs account settings; local cleanup does not delete provider assets. This adapter follows the Models API v1.3 flow: create a direct-upload asset (`POST /assets`), poll asset readiness, index the ready asset (`POST /indexes/{index}/indexed-assets`), poll indexed-asset readiness, and search that indexed asset once per query. Searches are visual-only, filtered to the chosen video, and return up to ten candidates per query. API keys stay on the server. Provider HTTP errors, error codes, and Retry-After headers are forwarded so callers can distinguish invalid credentials, invalid input, missing resources, and rate limits. Requests are not retried automatically, avoiding duplicate uploads or indexing.

References: [Models search quickstart](https://docs.twelvelabs.io/v1.3/docs/get-started/quickstart/search), [direct uploads](https://docs.twelvelabs.io/v1.3/api-reference/upload-files/direct-uploads/create), [index an asset](https://docs.twelvelabs.io/v1.3/api-reference/index-content/create), and the [official Python SDK](https://github.com/twelvelabs-io/twelvelabs-python). The implementation uses REST from the existing TypeScript server and does not require Python or Jockey. The endpoint reference requires readiness polling for every upload, including small files; this implementation follows that rule even though the SDK README currently describes small files as synchronous.

Provider confidence categories are displayed as returned. The scoring inputs for importance, context, audio, reaction, and preference are review values, not automatically extracted measurements. Ranking uses the weighted flowchart factors; selection favors different event labels, excludes overlapping windows, preserves complete events, and orders clips chronologically. The result can be shorter than the target when whole events will not fit.

## Scope

Local development remains available without login. Production is opt-in, uses existing MatchWatch accounts, signs video references per user, limits processing per instance, and requires explicit runtime configuration. See [the separate hackathon deployment guide](../deploy/highlights/README.md) for serving branch `hacketong` at `matchwatch.us/app` without redeploying the existing main site. This prototype does not implement persistent jobs, durable distributed quotas, live ingestion, URL ingestion, automatic key-frame analysis, overlays, music, transitions, slow motion, or replay effects. Output is 720p H.264 MP4 with the source audio where present. Detection needs real credentials; manual marking and export do not.

Run tests from the repository root with `npx tsx --test HtownKickoff-main/src/lib/highlight-plan.test.ts HtownKickoff-main/src/lib/twelvelabs.test.ts`. Provider tests use mocked HTTP responses; they do not upload media or require credentials. Live detection must be checked separately with a real API key and index.
