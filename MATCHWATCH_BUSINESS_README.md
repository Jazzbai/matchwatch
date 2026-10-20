# MatchWatch: product history and current business model

**Updated October 20, 2026 · Working founder document**

Platform: [matchwatch.us](https://matchwatch.us)  
Repository: [Jazzbai/matchwatch](https://github.com/Jazzbai/matchwatch)  
Intended streaming address: **stream.matchwatch.us**

This document combines the development story, current product, proposed business model,
and next steps. It describes repository capabilities and reported infrastructure status;
it does not claim every feature is already deployed, generating revenue, or commercially validated.

## 1. What MatchWatch is

MatchWatch connects sports fans with games, places to watch, independent creators,
and game recordings. It is evolving from sports discovery and venue engagement into
a platform where people can broadcast their own games, share a watch link, keep recordings,
and return to favorite moments.

**Product promise:** Find the game. Find your crowd. Share the action. Keep the moments.

The two connected parts of the business are:

- **MatchWatch venues and fan discovery:** sports schedules, sports bars, watch parties,
  venue pages, reservations, and fan engagement.
- **MatchWatch Stream:** creator dashboards, public live watch pages, private recording
  libraries, and saved YouTube recap links.

## 2. Development history: earlier work through today

The earlier phases below describe development order, not invented launch dates.

| Phase | Work completed or explored | Product direction |
| --- | --- | --- |
| Sports discovery foundation | Accounts, sports schedules, teams and leagues, venue discovery, maps, bookings, and administrative tools | Help fans decide what and where to watch |
| Venue and fan engagement | Venue content, events, posts, reviews, menus, QR/check-in and prediction-related workflows | Help venues organize sports audiences and engage visitors |
| Dashboard presentation | Sports-themed cards and an auto-rotating carousel; exploration of featured sports bars and sports personalities | Improve discovery and presentation; visual iterations alone were not a new revenue model |
| Streaming concept | A separate streaming experience with live games, past games, shareable watch links, and potential match or monthly access | Connect creators with viewers |
| Initial streaming demo | Sample broadcasts, a creator studio, illustrative access passes, and browser-local demo state | Demonstrate the workflow before integrating real infrastructure |
| Real recap discovery, October 19 | Replaced invented fixtures in the public recap feed with completed games and match-linked YouTube videos; added US-region checks and external YouTube playback | Make past-game discovery useful and credible |
| Expanded weekly coverage, October 19 | Added college football and additional official publishers; the saved release catalog contained 192 completed games and 134 recap links | Broaden the rolling seven-day recap library |
| Self-hosted media setup | MediaMTX was started in Coolify on the existing storage server; shared logs confirmed RTMP and HLS listeners | Receive camera video without purchasing a managed streaming plan |
| Personal streaming release, October 20 | Added account-owned broadcasts, per-broadcast publishing credentials, private recording uploads and playback, MediaMTX recording access, MinIO archiving, and YouTube favorites | Give each person their own channel and video library |
| Next stage | Production configuration, physical GoPro testing, creator pilots, then AI-assisted highlights | Validate the complete experience with real users |

The October 19 counts describe a checked snapshot, not a promise of today's totals or
complete coverage of every sport. The feed uses a rolling seven-day window and supported competitions.

## 3. Current product and implementation status

| Capability | Status as of October 20 |
| --- | --- |
| Sports discovery, venue and account foundation | Present in the existing application; live production coverage varies by integration and data sync |
| Real results and YouTube recap discovery | Implemented; videos are matched to teams and date and checked against known US restrictions |
| YouTube playback | Opens on YouTube; uploader and regional availability can change |
| Personal streaming dashboard | Implemented at `/stream/studio`, linked as My dashboard |
| Personal broadcasts | Implemented with account ownership and unique publishing credentials |
| GoPro-compatible streaming path | RTMP ingest and HLS playback integration implemented and tested with an encoder; a physical GoPro test remains |
| Camera connection in production | MediaMTX listeners were confirmed; new account-based configuration and full production testing remain |
| Recording library | Private video uploads, playback, deletion, and access to the user's broadcast recordings implemented |
| Save a broadcast recording | Implemented: copy a selected recording from MediaMTX into private S3-compatible storage |
| YouTube favorites | Implemented with account-based storage, sport filtering, and Save buttons on recap cards |
| Paid match passes and subscriptions | Proposed business options; no real streaming billing or creator payouts implemented |
| AI video search and automatic recaps | Planned; not implemented by the streaming release |
| Ray-Ban Meta glasses | Future exploration; direct capture/streaming compatibility has not been verified |

Latest streaming implementation: **`3abcd2d`**, pushed to the repository's main branch.
Six streaming integration tests, eight recap tests, type checks, and frontend/API builds
passed during development. The media test covered RTMP ingest, HLS playback, active
publisher disconnection, replay, MinIO archiving, signed upload, and deletion using
temporary local containers. This is development evidence, not proof of production uptime or scale.

## 4. Who the platform serves

| Customer or user | Need | MatchWatch offering |
| --- | --- | --- |
| Sports fans | Find games, a place to watch, and useful recaps | Match discovery, venue discovery, recap links, and favorites |
| Community creators and teams | Broadcast games and keep recordings | Personal dashboard, GoPro publishing address, watch links, and private library |
| Sports bars and venues | Attract the right fans and organize match-day activity | Venue/event pages, watch-party discovery, reservations, and engagement workflows |
| Local organizers | Help people follow games they cannot attend | Shareable live watch pages and recorded-game workflows |
| Sponsors and local businesses | Reach relevant sports communities | Future sponsored placement and campaign opportunities, subject to measured results |

Initial audience to test: Texas sports communities, local teams, creators, and sports
venues. US availability is the current target for the recap experience. These are target
segments, not claims of contracted customers.

## 5. Current business model

**Current stage: product development and pilot preparation.** The current streaming
release provides free public live watch pages with signed-in creator dashboards and
private libraries. No revenue, paying-customer count, active-user count, or commercial
partnership has been established in this development record.

The working model is a free fan experience supported by potential paid venue and creator
services. The following revenue streams are proposals to validate, not active billing features:

| Revenue opportunity | Who would pay | What they would receive | Current position |
| --- | --- | --- | --- |
| Venue tools | Sports bars and venues | Enhanced event management, audience engagement, and reporting | Proposed package around existing venue capabilities |
| Featured placement | Venues or sponsors | Clearly identified promotional placement for relevant sports audiences | Proposed; no guaranteed traffic or bookings |
| Creator tools | Teams and independent creators | Additional storage, longer retention, organizational tools, and future AI features | Proposed; limits, pricing, and willingness to pay need validation |
| Per-match access | Viewers | Access to an eligible creator's paid broadcast | Previously discussed; payment, entitlement enforcement, and payouts still needed |
| Monthly creator/channel access | Viewers | Recurring access to a creator's eligible content | Previously discussed; not a live subscription product |
| Production services | Teams, venues, or organizers | Optional filming, editing, or event-content support | Potential service offering; scope and fulfillment need validation |

No final prices have been set. Earlier demo prices such as $4.99 per match and $9.99 per
month were illustrative interface examples, not approved offers or implemented checkout.

The founder's current infrastructure preference is **no paid managed-streaming plan**.
That does not rule out future customer subscriptions; it means running the media server
on existing infrastructure rather than buying a streaming-provider subscription now.

## 6. How the experience works

**Creator:** Sign in → create a broadcast → copy the private publishing address → connect
a compatible GoPro through Quik/RTMP → share the public watch link → end the broadcast →
play or save its recording.

**Viewer:** Open the public watch link → watch the live broadcast. Separately, explore
recent games, open their recap on YouTube, and sign in to save favorite video links.

**Recording owner:** Upload an existing video or save a broadcast recording → filter the
library by sport or search → play, retain, or delete saved videos.

Current access rules: public live pages; account-owned private recordings and favorites.
People receiving an owner-generated recording playback link can use it until it expires.
YouTube favorites store links, not copies of YouTube videos. The creator must confirm
permission to broadcast and record; that confirmation is not an independent rights verification.

## 7. Technology and operating costs

| Layer | Current approach |
| --- | --- |
| Website | Next.js and React |
| Accounts and API | Hono, TypeScript, existing authentication |
| Account data | PostgreSQL and Drizzle migrations |
| Jobs/cache foundation | Redis and BullMQ in the existing application |
| Live video | Self-hosted MediaMTX: RTMP input, HLS browser playback |
| Broadcast recording | MediaMTX persistent volume, currently configured for seven-day retention |
| Retained video library | Private S3-compatible bucket, using the existing MinIO infrastructure |
| Recap discovery | Sports results and YouTube metadata integrations |
| Hosting/deployment | Docker and Coolify |

Saved recording parts and direct uploads currently have a 2 GB limit. Long broadcast
timespans are saved in parts of up to 15 minutes. Browser playback depends on codecs;
the current release does not add a transcoding pipeline.

Costs still include hosting, outbound video traffic, storage, backups, domain operations,
and any future AI/API usage. A useful planning calculation is:

**Viewer delivery GB ≈ bitrate in Mbps × viewing hours × 0.45.**

For example, one viewer-hour at 4 Mbps transfers roughly 1.8 GB before overhead. This
is a planning estimate, not a measured operating cost. Track cost per broadcast, viewer-hour,
and retained GB before setting prices or promising unlimited use.

## 8. AI and hackathon direction

The proposed hackathon project is **MatchWatch AI Recap**:

**Game recording → suggested moments → creator review → short recap → shareable watch link.**

Proposed teammate responsibilities:

1. Founder/platform work: application, accounts, uploads, streaming, and viewer experience.
2. AI teammate: video understanding and natural-language searches such as “find the best saves.”
3. Video teammate: assemble reviewed clips into a recap and prepare shareable exports.

TwelveLabs is a candidate for video understanding; FFmpeg is a candidate for clip assembly.
Neither is integrated into an operational AI recap pipeline yet. Usage permissions should
remain attached to the recording and reviewed before publication. Event participation or
mentioning technology providers does not establish a partnership or sponsorship of MatchWatch.

## 9. Roadmap and validation

### Immediate: finish the production streaming connection

- Apply the account-based MediaMTX configuration and private recording bucket settings.
- Complete HTTPS playback, DNS, and camera-network connectivity.
- Redeploy the API and frontend, then test with two real user accounts.
- Run a physical GoPro broadcast and verify live viewing, end/disconnect, recording,
  permanent save, and favorites across devices.
- Establish storage quotas, cleanup, monitoring, backups, and recovery procedures before
  unrestricted public creator signup.

### Next: run a small pilot

- Recruit a small group of creators/teams and interested venues.
- Measure successful broadcasts, viewer watch time, recording saves, repeat creators,
  favorites, venue inquiries, and infrastructure usage.
- Interview participants about the feature they would pay for; test one paid offer only
  after the end-to-end free workflow is reliable.
- Validate payment processing, access enforcement, ownership permissions, support, and
  creator payouts before launching paid viewing.

### Later: AI tools and additional capture devices

- Add searchable moments and creator-reviewed AI recap generation.
- Evaluate phones and other compatible cameras as capture sources.
- Explore Ray-Ban Meta glasses when model compatibility and supported integrations are
  confirmed. Do not advertise direct glasses streaming as available today.
- Keep capture-device integrations connected to the same broadcast, recording, and
  library workflow so creators do not need separate products for every camera.

## 10. Supporting implementation documents

- [Technical repository README](README.md)
- [Streaming deployment and verification guide](deploy/streaming/README.md)
- [MediaMTX Docker Compose configuration](deploy/streaming/compose.yml)
- [API environment template](deploy/streaming/api.env.example)

**Working positioning:** MatchWatch helps sports communities discover where to watch,
broadcast their own games, and keep the moments that matter. The next business milestone
is a reliable production pilot with evidence of user demand and delivery costs.
