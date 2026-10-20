# Personal streaming deployment

The real dashboard is `/stream/studio`; each signed-in MatchWatch user has broadcasts,
private saved videos, and YouTube favorites. These are stored in PostgreSQL, not browser
storage. Existing public recap links still open on YouTube. Favorites store links only;
MatchWatch does not download YouTube videos.

## Deploy in this order

1. Add the API variables from `api.env.example` to **matchwatch-api**. Use the existing
   private S3 credentials and a new private `matchwatch-recordings` bucket. That bucket
   must not have an anonymous read/list policy. Configure its CORS to allow the frontend
   origins to PUT/GET with Content-Type and x-amz-meta-owner headers. The S3 endpoint used
   for browser signatures must be reachable over HTTPS from viewers' devices.
2. Redeploy **matchwatch-api**. Startup migration `0027_personal_streaming` creates the
   account-owned tables. If startup migrations are disabled, run the existing migration
   command separately. No existing storage volumes are replaced.
3. Edit the **existing MediaMTX Compose service**, keeping its `live-recordings` volume
   and resource identity. Use `compose.yml` as the full replacement. Set its
   `MEDIAMTX_AUTH_URL` variable to `http://YOUR_API_PRIVATE_IP:4000/api/v1/streams/media-auth`.
   This private address must be reachable from the MediaMTX container. Remove the old
   `MTX_AUTHINTERNALUSERS`; per-broadcast authentication replaces the shared GoPro password.
4. Deploy MediaMTX. Set its Coolify HTTP domain to `https://live.matchwatch.us:8888`.
   Coolify should route HTTPS on external port 443 to container port 8888. DNS must point
   to the server/proxy that routes to this service. Do not use the frontend's
   `stream.matchwatch.us` domain for this second service.
5. Allow access to 9996/9997 only from the MatchWatch API server using host/network firewall
   rules. They are bound to the private storage-6 address, not all host interfaces.
   RTMP TCP 1935 must be reachable from the camera; external networks need a public
   endpoint/router forward. GoPro RTMP credentials are unencrypted, so use a trusted
   network/VPN for camera publishing. Viewers use HTTPS.
6. Redeploy **matchwatch-ui**. Keep API_PROXY_TARGET pointing at the real backend.
   The frontend must proxy `/api/v1` to the backend, including streaming playback.
   Allow up to ten minutes for archive transfers in any reverse-proxy timeout settings.
7. Sign in, open **My dashboard**, create a broadcast, confirm permission to record, and
   paste its private publishing URL into GoPro Quik's RTMP field. Credentials appear
   only on creation/replacement; replacement invalidates the old password for future
   connections. Existing active connections stop through End broadcast.

## Recordings and limits

- MediaMTX records one-minute segments on its persistent disk volume. Its playback server
  may merge contiguous segments into a longer timespan. The library lists available
  timespans and provides owner-generated playback links valid for 30 minutes.
- Broadcast recordings remain on disk for seven days. Save to my library copies an
  owner-selected timespan to the private S3 bucket via multipart upload. The dashboard
  splits long timespans into parts of up to 15 minutes (maximum 2 GB per part).
- Uploaded MP4, WebM, and MOV files (up to 2 GB) use direct signed uploads, then server
  validation before appearing in the library. Browser codec support varies; H.264 MP4
  is a good baseline. No transcoding service or paid provider is enabled.
- Private S3 videos use signed playback links valid for one hour. Deleting a saved video
  removes its stored object. Downloading and sharing an owner-generated signed link
  grants temporary access to that recording; the app does not expose storage credentials.
- Uploads and archives use existing hosting bandwidth/disk. Configure storage lifecycle
  rules for abandoned uploads and incomplete multipart transfers, and appropriate account
  quotas before opening the service to unrestricted public signups.
- Live watch pages are public/free. Accounts, recording libraries, and favorites are
  private. No payments or subscriptions are implemented by this change.

## Verification

The opt-in integration suite requires a disposable local PostgreSQL database named
`stream_test`. Never point it at the application database:

```powershell
$env:DATABASE_URL='postgresql://postgres:stream-test-only@127.0.0.1:55439/stream_test'
node_modules/.bin/tsx.cmd --test apps/api/src/routes/streams.integration.test.ts
```

Set `RUN_LIVE_STREAM_TEST=1` to also exercise a real RTMP encoder, HLS viewing,
active camera disconnection, private recording playback, multipart MinIO archiving,
signed video upload, and deletion. This opt-in test uses temporary local Docker
containers named `matchwatch-live-test-media` and `matchwatch-live-test-storage`,
with the official MediaMTX 1.21.2 FFmpeg image and Coollabs MinIO image. It cleans
up those containers after the run. The PostgreSQL fixture must be disposable.

Validated for this release: six streaming integration tests (including the full media
flow), eight existing recap tests, frontend and API type checks, and the frontend
production build. Production configuration and a physical GoPro broadcast still
require testing on your own network.

Official references: [HTTP authentication](https://mediamtx.org/docs/features/authentication),
[recording playback](https://mediamtx.org/docs/features/playback),
[Docker installation](https://mediamtx.org/docs/kickoff/install).
