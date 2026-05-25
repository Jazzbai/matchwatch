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
  // ── Add remaining 9 cities below as you collect their links ──
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

  // Check for duplicate
  const existing = await db.select({ id: venues.id, name: venues.name })
    .from(venues)
    .where(and(
      ilike(venues.name, '%fan festival%'),
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
