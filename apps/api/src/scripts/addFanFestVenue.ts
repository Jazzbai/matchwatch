/**
 * addFanFestVenue.ts
 *
 * Adds an official FIFA Fan Festival venue for a specific city.
 * Run once per city. Skips if a fan fest for that city already exists.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/addFanFestVenue.ts --city=houston
 *   npx tsx apps/api/src/scripts/addFanFestVenue.ts --city=dallas
 */

import 'dotenv/config';
import { eq, and, ilike } from 'drizzle-orm';
import { db } from '../db/client.js';
import { venues, users } from '../db/schema.js';

// ─── Fan Festival definitions (add one per city as they come in) ───────────────

interface FanFestDef {
  citySlug: string;
  cityName: string;
  state: string;
  timezone: string;
  name: string;
  addressLine1: string;
  lat: number;
  lng: number;
  description: string;
  website: string;
  coverImageUrl: string;
  galleryUrls: string[];
  dates: string;
  capacity: number;
}

const FAN_FESTS: FanFestDef[] = [
  {
    citySlug: 'houston',
    cityName: 'Houston',
    state: 'TX',
    timezone: 'America/Chicago',
    name: 'FIFA Fan Festival™ Houston',
    addressLine1: 'EaDo — East Downtown, near Shell Energy Stadium',
    lat: 29.7524,
    lng: -95.3519,
    description:
      'The official FIFA Fan Festival™ for Houston\'s World Cup 2026 matches. Free-admission fan zone in the heart of EaDo featuring the Esphora projection dome, Houston Hall (air-conditioned), giant match-viewing screens, live performances, youth soccer, food & beverages, and VIP cabanas. Open on all 34 Houston match days, June 11 – July 19 2026. Capacity: 15,000 daily visitors.',
    website: 'https://www.fwc26houston.com/fifafanfestivalhou',
    coverImageUrl:
      'https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,h_900,q_75,w_1200/v1/clients/houston/FanFest2_8c3ec7c1-0e8e-4dac-9dc5-fbb0f293cb5f.png',
    galleryUrls: [
      'https://static.wixstatic.com/media/dd39d7_89059702b498484792f8cb3d944e6928~mv2.jpg/v1/crop/x_0,y_125,w_3840,h_1641/fill/w_925,h_395,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/FWC26_HOU_ENTRANCE_3D_RENDER_ISO_VIEW_V3.jpg',
      'https://static.wixstatic.com/media/dd39d7_fbe536a2bb1e4d5f990f8eabd9b72ee5~mv2.jpg/v1/fill/w_529,h_297,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/FWC26_HOU_CABANA_3D_RENDER_FRONT_VIEW_CMYK_V3.jpg',
      'https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,f_jpg,h_451,q_65,w_768/v1/clients/houston/Houston_MWHoustonLLC_PPS_23DEC2025_c73e2836-d0f4-4a87-b515-f04c2a7ebf08.jpg',
    ],
    dates: 'June 11 – July 19, 2026',
    capacity: 15000,
  },
  {
    citySlug: 'dallas',
    cityName: 'Dallas',
    state: 'TX',
    timezone: 'America/Chicago',
    name: 'FIFA Fan Festival™ Dallas',
    addressLine1: 'Fair Park — Lots 9 & 10, The Pavilion Amphitheater',
    lat: 32.7770,
    lng: -96.7441,
    description:
      'The official FIFA Fan Festival™ for Dallas World Cup 2026 matches. A free, open-to-all 1-million-square-foot celebration at historic Fair Park featuring live match broadcasts on giant screens, The Pavilion main stage (7,000 covered seats + hillside seating), mini-pitches, concerts, sponsor zones, and food courts arranged as a walkable village. Capacity: 35,000 fans. June 11 – July 19, 2026.',
    website: 'https://www.dallasfwc26.com/our-venues/fan-festival/',
    coverImageUrl:
      'https://www.dallasfwc26.com/wp-content/uploads/2026/04/FFFdallas_render01_Feb16-1024x576.jpg',
    galleryUrls: [
      'https://www.dallasfwc26.com/wp-content/uploads/2026/05/FFF-mainstage-1024x576.jpg',
      'https://www.dallasfwc26.com/wp-content/uploads/2026/04/FFFdallas_render02_Feb16-1024x576.jpg',
      'https://www.dallasfwc26.com/wp-content/uploads/2026/04/FFFdallas_render05_Feb16-1024x576.jpg',
    ],
    dates: 'June 11 – July 19, 2026',
    capacity: 35000,
  },
  // ── Seattle — Official FIFA Fan Festival™ at Seattle Center ─────────────────
  {
    citySlug: 'seattle',
    cityName: 'Seattle',
    state: 'WA',
    timezone: 'America/Los_Angeles',
    name: 'FIFA Fan Festival™ Seattle — Seattle Center',
    addressLine1: 'Seattle Center — The Armory & Mural Amphitheatre, 305 Harrison St',
    lat: 47.6205,
    lng: -122.3493,
    description:
      'The official FIFA Fan Festival™ for Seattle\'s World Cup 2026 matches. "Let\'s Play SEA \'26 — World Soccer Fan Celebration" at Seattle Center — a massive civic celebration beneath the Space Needle featuring a giant indoor screen at The Armory (all-weather viewing), outdoor big-screen viewing at the Mural Amphitheatre, international DJs, immersive fan activations, public art, fitness activities, food vendors, and campus-wide programming across Seattle Center\'s full grounds.',
    website: 'https://www.seattlecenter.com/events/lets-play-sea-26',
    coverImageUrl:
      'https://www.seattlecenter.com/Images/Events/Productions/Lets%20Play%20SEA%2026/LPSea26_1920x1080.jpg',
    galleryUrls: [],
    dates: 'June–July 2026 (all match days)',
    capacity: 30000,
  },
  {
    citySlug: 'new-york',
    cityName: 'New York',
    state: 'NY',
    timezone: 'America/New_York',
    name: 'NYNJ World Cup 26 & Telemundo Fan Village — Rockefeller Center',
    addressLine1: '30 Rockefeller Plaza',
    lat: 40.7587,
    lng: -73.9787,
    description:
      'Official NYNJ World Cup 26 & Telemundo Fan Village at Rockefeller Center. Open to the public July 6–19, 2026 at 30 Rockefeller Plaza, with The Rink transformed into a soccer pitch surrounded by large screens for live match broadcasts, Channel Gardens tributes to World Cup champions, Top of the Rock soccer experiences, FIFA Museum programming, family-friendly activities, and brand activations across Rockefeller Center.',
    website: 'https://www.rockefellercenter.com/events/world-cup-2026',
    coverImageUrl:
      'https://www.rockefellercenter.com/_next/image?q=75&url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fbs9rmafh%2Fecomm-main%2F9edb5e95f86ac5988321de75a9eb3a19a43f6cc7-3949x1974.jpg&w=3840',
    galleryUrls: [],
    dates: 'July 6–19, 2026',
    capacity: 0,
  },
  // ── Seattle / Washington State — 9 community fan zones ─────────────────────
  {
    citySlug: 'bellingham',
    cityName: 'Bellingham',
    state: 'WA',
    timezone: 'America/Los_Angeles',
    name: 'FIFA Fan Zone™ Bellingham',
    addressLine1: '904 Potter St — Waterfront District',
    lat: 48.7342,
    lng: -122.4971,
    description:
      'Official FIFA Fan Zone for Seattle\'s 2026 World Cup, hosted in Bellingham\'s waterfront district. Free-admission outdoor fan zone featuring live match screenings on giant screens, local food vendors, interactive soccer activities, youth programming, and community celebrations. Open on select World Cup match days, June–July 2026.',
    website: 'https://www.bellingham.org/fan-zone',
    coverImageUrl:
      'https://bellingham.objects.liquidweb.services/photos/6925-fifa_webheader_final-2800x900.jpg',
    galleryUrls: [],
    dates: 'June–July 2026',
    capacity: 5000,
  },
  {
    citySlug: 'bremerton',
    cityName: 'Bremerton',
    state: 'WA',
    timezone: 'America/Los_Angeles',
    name: 'FIFA Fan Zone™ Bremerton',
    addressLine1: 'Harborside Fountain Park, 100 Washington Ave',
    lat: 47.5649,
    lng: -122.6271,
    description:
      'Official FIFA Fan Zone in Downtown Bremerton for Seattle\'s 2026 World Cup. Bremerton is a designated official fan zone city, hosting celebrations and soccer watch parties in its vibrant Downtown waterfront district. Enjoy giant match-viewing screens, live entertainment, local vendors, and community atmosphere on select World Cup match days, June–July 2026.',
    website: 'https://www.downtownbremerton.org/events/bremerton-fan-zones',
    coverImageUrl:
      'https://www.downtownbremerton.org/wp-content/uploads/2025/bremerton-fan-zone-wc26.jpg',
    galleryUrls: [],
    dates: 'June–July 2026',
    capacity: 3000,
  },
  {
    citySlug: 'olympia',
    cityName: 'Olympia',
    state: 'WA',
    timezone: 'America/Los_Angeles',
    name: 'Olympia-Lacey Official FIFA Fan Zone™',
    addressLine1: 'Port of Olympia — Port Plaza, 701 Columbia Street NW',
    lat: 47.0459,
    lng: -122.9025,
    description:
      'Official FIFA Fan Zone for Seattle\'s 2026 World Cup at Port of Olympia\'s waterfront Port Plaza. A high-energy waterfront festival experience featuring live match screenings on giant screens, local food vendors, community partners, interactive activities, and live music. VIP packages available ($75). General admission $10; youth 12 & under free. Open June 19, 24, 25 & 26, 2026.',
    website: 'https://thurstonchamber.com/fanzone/',
    coverImageUrl:
      'https://thurstonchamber.com/wp-content/uploads/2026/03/Olympia_Lacey-Official-Logo.png',
    galleryUrls: [],
    dates: 'June 19, 24, 25 & 26, 2026',
    capacity: 10000,
  },
  {
    citySlug: 'tacoma',
    cityName: 'Tacoma',
    state: 'WA',
    timezone: 'America/Los_Angeles',
    name: 'Puyallup Tribe Official FIFA Fan Zone™',
    addressLine1: '3001 Puyalupabsh St',
    lat: 47.2276,
    lng: -122.4131,
    description:
      'Official FIFA Fan Zone in Tacoma, hosted by the Puyallup Tribe — the first Indigenous nation formally represented at the FIFA World Cup™. A historic community celebration featuring official fan zone viewing parties, cultural programming, interactive experiences, live entertainment, and community gatherings during Seattle\'s 2026 World Cup matches. Select match days June 15 – July 6, 2026.',
    website: 'https://puyallupalltogether.org',
    coverImageUrl:
      'https://puyallupalltogether.org/wp-content/uploads/2026/02/AdobeStock_924205395-scaled.jpeg',
    galleryUrls: [],
    dates: 'June 15 – July 6, 2026',
    capacity: 8000,
  },
  {
    citySlug: 'pasco',
    cityName: 'Pasco',
    state: 'WA',
    timezone: 'America/Los_Angeles',
    name: 'FIFA Fan Zone™ Pasco / Tri-Cities',
    addressLine1: 'Gesa Stadium & Pasco Sports Complex, 6200 Burden Blvd',
    lat: 46.2418,
    lng: -119.1028,
    description:
      'Official Seattle FWC26 Fan Zone at Gesa Stadium & Pasco Sports Complex in the Tri-Cities. A summer 2026 soccer celebration featuring large-screen outdoor match viewing with festival atmosphere, live music, family-friendly activities, local food vendors, and easy riverside access. Open June 15, 19, July 1 & 6, 2026.',
    website: 'https://www.pasco-wa.gov/1715/Official-Seattle-FWC26-Fan-Zone',
    coverImageUrl:
      'https://www.pasco-wa.gov/ImageRepository/Document?documentId=69217',
    galleryUrls: [
      'https://www.pasco-wa.gov/ImageRepository/Document?documentID=66272',
      'https://www.pasco-wa.gov/ImageRepository/Document?documentID=66285',
    ],
    dates: 'June 15, 19, July 1 & 6, 2026',
    capacity: 15000,
  },
  {
    citySlug: 'yakima',
    cityName: 'Yakima',
    state: 'WA',
    timezone: 'America/Los_Angeles',
    name: 'FIFA Fan Zone™ Yakima — Yakima Valley SunDome',
    addressLine1: 'Yakima Valley SunDome at State Fair Park, 1301 S Fair Ave',
    lat: 46.5840,
    lng: -120.5050,
    description:
      'Official FIFA Fan Zone for Seattle\'s 2026 World Cup at the Yakima Valley SunDome and State Fair Park. A community celebration in the heart of Washington wine country featuring live match broadcasts on giant screens, local entertainment, food vendors, interactive fan activities, and family-friendly programming on select World Cup match days, June–July 2026.',
    website: 'https://www.statefairpark.org/',
    coverImageUrl:
      'https://www.statefairpark.org/ImageRepository/Document?documentId=1001',
    galleryUrls: [],
    dates: 'June–July 2026',
    capacity: 12000,
  },
  // ── Add remaining 8 cities below: NYC, LA, Miami, Atlanta, SF, Philadelphia, Boston, Kansas City ──
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string, city: string) {
  return `${name} ${city}`.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').slice(0, 180)
    + '-fanfest';
}

async function getOwnerId() {
  const email = process.env.SYSTEM_OWNER_EMAIL ?? 'admin@matchwatch.us';
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!row) throw new Error(`System owner not found: ${email}`);
  return row.id;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const cityArg = process.argv.find(a => a.startsWith('--city='))?.split('=')[1]?.toLowerCase();
  if (!cityArg) throw new Error('Provide --city=<slug> e.g. --city=houston');

  const def = FAN_FESTS.find(f => f.citySlug === cityArg);
  if (!def) throw new Error(`No Fan Fest definition found for city: ${cityArg}. Add it to FAN_FESTS array first.`);

  console.log(`\n🏟️  Adding official FIFA Fan Festival: ${def.name}`);

  // Check for duplicate (matches both "Fan Festival" and "Fan Zone" naming)
  const existing = await db.select({ id: venues.id, name: venues.name })
    .from(venues)
    .where(and(
      ilike(venues.name, `%${def.name.split('™')[0].trim()}%`),
      ilike(venues.city, `%${def.cityName}%`),
    ))
    .limit(1);

  if (existing.length > 0) {
    console.log(`⚠️  Already exists: ${existing[0].name} (${existing[0].id}) — skipping.`);
    return;
  }

  const ownerId = await getOwnerId();

  const [row] = await db.insert(venues).values({
    ownerId,
    name: def.name,
    slug: slugify(def.name, def.cityName),
    addressLine1: def.addressLine1,
    city: def.cityName,
    stateProvince: def.state,
    country: 'US',
    timezone: def.timezone,
    lat: String(def.lat),
    lng: String(def.lng),
    description: def.description,
    shortDescription: `Official FIFA Fan Festival™ for World Cup 2026 in ${def.cityName}. Free admission, ${def.dates}.`,
    website: def.website,
    coverImageUrl: def.coverImageUrl,
    capacity: def.capacity,
    amenities: ['BIG_SCREEN', 'OUTDOOR', 'FOOD', 'BAR', 'WATCH_PARTY', 'SOCCER', 'LIVE_MUSIC', 'FREE_ENTRY', 'OFFICIAL_FAN_FEST'],
    cuisineTags: ['AMERICAN', 'INTERNATIONAL'],
    priceRange: 'BUDGET',
    isVerified: true,
    isActive: true,
    isFeatured: true,
    approvalStatus: 'APPROVED',
    metadata: {
      officialFanFest: true,
      worldCupCity: def.citySlug,
      fanFestDates: def.dates,
      galleryUrls: def.galleryUrls,
      importedFrom: 'manual_fan_fest',
      importedAt: new Date().toISOString(),
      sourceUrls: [def.website],
    },
  }).returning({ id: venues.id });

  console.log(`✅  Inserted: ${def.name} → ${row.id}`);
  console.log(`    City: ${def.cityName} | Lat: ${def.lat} | Lng: ${def.lng}`);
  console.log(`    Cover: ${def.coverImageUrl.slice(0, 80)}...`);
  console.log(`    Gallery: ${def.galleryUrls.length} images\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('❌', (err as Error).message); process.exit(1); });
