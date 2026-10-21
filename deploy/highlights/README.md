# Separate hackathon deployment at matchwatch.us/app

Deploy `hacketong` as a new Coolify application named `matchwatch-hackathon`, alongside the existing `matchwatch-ui` application on `main`. This is an independent frontend container. Do not change the branch or domain of the existing application and do not run the root Compose stack for this release. No database migration or MediaMTX change is needed.

## Coolify application

| Setting | Value |
| --- | --- |
| Repository | `Jazzbai/matchwatch` |
| Branch | `hacketong` |
| Build pack | Dockerfile |
| Base directory / build context | `/HtownKickoff-main` |
| Dockerfile location | `/Dockerfile` (relative to the base directory) |
| Container port | `3000` |
| Domain | HTTPS, `matchwatch.us`, path `/app`, port `3000` |
| Advanced > Proxy > Path prefixes | **Keep paths as-is** |
| Health check path | `/app/api/stream/highlights` |

Keep the `/app` prefix when forwarding requests. Next.js is built with `basePath=/app`, so its JavaScript, CSS, and highlight API all live below `/app`. The `/app` landing route rewrites to the highlight studio. Root-site assets and API routes retain their existing routes.

Use a temporary testing domain with the same `/app` path first if desired; update `HIGHLIGHTS_PUBLIC_ORIGIN` to that domain's origin. Both applications must use the proxy receiving traffic for `matchwatch.us`. Do not point the site's DNS to another server for this release.

## Build arguments (non-secret)

```dotenv
NEXT_PUBLIC_APP_BASE_PATH=/app
HIGHLIGHTS_STANDALONE=true
NEXT_PUBLIC_API_URL=/api/v1
API_PROXY_TARGET=http://YOUR_EXISTING_API_PRIVATE_HOST:4000
```

The base path and standalone mode must be set at build time. Set them in Coolify as build variables/build arguments, not only runtime variables. Rebuild after changing either. Do not set any TwelveLabs key as a build argument.

## Runtime environment (new application only)

```dotenv
HIGHLIGHTS_ENABLED=true
HIGHLIGHTS_PUBLIC_ORIGIN=https://matchwatch.us
HIGHLIGHTS_SIGNING_SECRET=GENERATE_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
TWELVELABS_API_KEY=YOUR_EXISTING_KEY
TWELVELABS_INDEX_ID=6ad809fa9c038876f3560e4c
API_PROXY_TARGET=http://YOUR_EXISTING_API_PRIVATE_HOST:4000
FFMPEG_PATH=/usr/bin/ffmpeg
```

Use the existing API's reachable private address/network alias; the new container must be able to reach it. Requests verify the signed-in MatchWatch account through `GET /api/v1/user/me`. The browser uses the existing main site's sign-in and bearer token, and returns to `/app`. API keys stay on the server. `.dockerignore` excludes local environment files and local dependency/build directories.

Generate the signing secret with `openssl rand -hex 32`. Keep it stable across replicas/restarts. Video references are signed for a specific user and resource type, expiring after 24 hours. Production rejects unsigned references, cross-user references, unauthenticated processing, and cross-origin browser requests. Localhost development remains available without login.

For this initial deployment, run **one replica**. Limits are process-local: three upload attempts, ten indexing attempts, thirty search requests, ten export attempts, and sixty mutation requests per user per hour; at most two exports at a time per instance. Restarting resets counters. A distributed queue, durable quotas, and cancellation of server work on browser disconnect remain future scaling work. Do not configure unrestricted autoscaling with these process-local limits.

## Proxy and resources

Allow up to 210 MB request bodies and at least ten minutes for highlight request/response processing on this route. The application's file limit is 200 MB. Give this separate container explicit CPU and memory limits so video processing does not exhaust the main site's resources. Choose the actual limits based on available host capacity. FFmpeg is installed in the Docker runtime; temporary videos are cleaned after exports.

The router must match `Host(matchwatch.us) && (Path(/app) || PathPrefix(/app/))` ahead of the main site's host-only route. Coolify supports path-prefixed domains. Inspect generated proxy rules if your version matches all prefixes such as `/application`; ensure the route covers only `/app` and its descendants. Do not use prefix stripping. Do not bind this application to the bare root domain without the `/app` path.

## Publish and verify

1. Commit the reviewed changes and push `hacketong`; do not merge into `main` for this deployment.
2. Create the new application with these settings, then deploy it. Leave the existing application's automatic deployments on `main`.
3. Check `https://matchwatch.us/` still shows the existing site.
4. Check `https://matchwatch.us/app` shows the highlight studio, with CSS/JS requests only under `/app/_next/`.
5. Check `/app/api/stream/highlights` reports configured detection/export. An unauthenticated multipart POST must return 401 without uploading to TwelveLabs.
6. Sign in from the main site, return to `/app`, and test detection and MP4 export with a small video. Confirm an unrelated account cannot use a signed video reference from the first account.

Rollback by removing only the new `/app` route or rolling back the new application's image. Keep `main`, the existing frontend, API, databases, volumes, and streaming resources intact.

Sources: [Coolify path routing and prefix handling](https://coolify.io/docs/core/networking/domains), [Next.js basePath](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath).
