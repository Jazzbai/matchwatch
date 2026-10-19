# MatchWatch Stream — hackathon demo

This is an independent MatchWatch prototype for presenting a streaming and recap workflow. It is not an official Spurs, Tottenham, ScorePlay, or TwelveLabs integration.

## Present it

- `/stream`: browse sample live games, upcoming broadcasts, and past-game recordings; filter by sport or search by channel/title.
- `/stream/watch/demo-courtside`: simulate a single-match purchase or a channel subscription, then play a sample video. No card is collected and no money is charged.
- `/stream/watch/demo-soccer`: free demo viewing.
- `/stream/studio`: schedule a demo game under a nickname; choose sample access pricing, confirm footage permission, simulate going live, end the broadcast, and publish a replay entry.
- Use Camera rehearsal to preview a browser camera locally. Use the watch page's video file picker to present your own GoPro recording. Neither is uploaded or transmitted.
- Reset demo restores the sample catalog and clears simulated passes.

Sample prices ($4.99 per match and $9.99 per month/channel) are illustrative only. Monthly passes do not create or renew subscriptions. No AI analysis, rights verification, automatic highlight editing, real video broadcasting, or payment processing is claimed.

Custom games and simulated passes live in browser localStorage. Custom game links work only in that browser. Seeded sample links work across devices. The sample player is clearly labeled; it uses locally bundled demonstration footage, not the depicted fixture. You can select a local video instead for an offline presentation.

## Publish at stream.matchwatch.us using Coolify

1. Keep `matchwatch-ui` connected to `Jazzbai/matchwatch`, branch `main`.
2. Add `https://stream.matchwatch.us` to the frontend domains alongside the existing main domain.
3. Point the DNS `stream` record at the same public frontend/proxy target as `matchwatch.us`. Do not use the dashboard's private `10.0.1.12` address.
4. Redeploy `matchwatch-ui`. No API redeploy, database migration, video-service subscription, or payment key is required.
5. Verify HTTPS and that `https://stream.matchwatch.us/` opens the streaming catalog. Host rewrites also map `/watch/:id` and `/studio`; the main domain's homepage stays intact.

Camera access and clipboard sharing require HTTPS or localhost and browser permission. GoPro compatibility depends on the model and connection method. A real end-to-end broadcast is separate future work.

## Competition fit

The event brief offers Assisted Auto-Production and Rights and Compliance tracks. This demo supplies a viewer and creator presentation layer; it does not yet implement either complete competition challenge. Integrating the provided ScorePlay/TwelveLabs services and a producer-approval or rights-check workflow requires the event brief and access credentials. Keep those credentials out of source control.

