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


## YouTube recaps and past games

Add YOUTUBE_API_KEY to HtownKickoff-main/.env.local and restart the frontend. That file is ignored by Git. Enable YouTube Data API v3 in Google Cloud. In Coolify, set the same server-only variable on matchwatch-ui and redeploy; do not use a NEXT_PUBLIC_ prefix.

/api/stream/youtube retrieves embeddable video results for four sports, with Recaps and Past Games categories. Results are cached per frontend instance for one hour, concurrent identical requests are combined, and provider failures pause retries for one minute. Fixed query combinations bound quota use.

YouTube videos stay separate from simulated broadcasts and play in a privacy-enhanced YouTube player. Replay searches cannot guarantee a complete match or regional availability. Dates are upload dates, not fixture dates.

## Real past-week dashboard

The public /stream route now shows real completed results for the rolling previous 168 hours instead of demo fixtures. Coverage is explicitly listed: Premier League, La Liga, Bundesliga, Serie A, Ligue 1, MLS, Liga MX, Champions League, NBA, WNBA, MLB, and NFL. This is all returned games in those competitions, not every competition worldwide. Scoreboards are requested per UTC day, deduplicated by competition/event ID, and filtered by completion and actual kickoff time. Partial provider failures are disclosed.

YouTube links are matched from a curated publisher upload index (NBA/WNBA/MLB/NFL/MLS, major soccer leagues and selected broadcasters/clubs). The index reads up to 200 recent uploads per publisher and is cached for six hours to avoid a quota-heavy search for every game. Candidates need both teams, an explicit UTC or America/Chicago game date, appropriate upload timing, public embeddable status, and the selected recap/replay title classification. Full replays also need a duration of at least 30 minutes. These are conservative automated checks, not manual review or a guarantee of complete video coverage. Unknown or unmatched videos never become watch links.

The creator studio and old demo watch routes remain explicitly labeled simulations. They are not used to populate the public results dashboard. The rolling date window updates automatically, including on presentation day.

Official uploads without an explicit game date can match only when the pairing occurs once in the past-week feed, the upload follows kickoff by 1?48 hours, and the title has no contradictory year/date. Repeat pairings still require the explicit date. The public cards link to the actual YouTube video; the score-source link is not presented as a watch action.

## Online release: US past-week library

All public recap/replay actions open the original YouTube video in a new tab. Known US country restrictions are excluded using videos.contentDetails.regionRestriction; embedding permission is not required for these external links. Eligibility may change after lookup.

A non-secret catalog snapshot bundles real game metadata and 128 US-eligible recap links checked on October 19, 2026. If the frontend YouTube key is absent, matching saved links can still be served for their corresponding games; missing links are never invented. Snapshots expire after seven days, and results are always filtered to the rolling seven-day game window. A scoreboard outage uses saved games with a visible timestamp and incomplete-data notice. New games still require a runtime video key to discover new recaps.

Production activation requires Coolify access, the frontend domain binding, and DNS. As checked during release preparation, stream.matchwatch.us returned NXDOMAIN and matchwatch.us/stream returned 404. Source publication alone does not prove deployment. Do not mark the subdomain live until HTTPS responds with the current real-games dashboard.
