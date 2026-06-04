/**
 * seedJerseyPartyTemplates.ts
 *
 * Seeds the 10 World Cup jersey-party campaign templates from the Sport PBR
 * proposal. Idempotent — uses ON CONFLICT (slug) DO UPDATE so re-running
 * keeps the venue's activated events untouched but refreshes the source
 * template copy.
 *
 * Usage (from monorepo root):
 *   npx tsx apps/api/src/scripts/seedJerseyPartyTemplates.ts
 *
 * Or inside the api container:
 *   docker compose exec api npx tsx /app/apps/api/src/scripts/seedJerseyPartyTemplates.ts
 */

import { sql } from 'drizzle-orm';
import { db } from '../db/client';
import { campaignTemplates } from '../db/schema';

type SeedTemplate = {
    slug: string;
    title: string;
    description: string;
    defaultPrizes: Array<{ tier: string; prize: string }>;
    defaultTags: string[];
    defaultBookingNotes: string;
    defaultContestRules: string;
    category: string;
    sortOrder: number;
};

const TEMPLATES: SeedTemplate[] = [
    {
        slug: 'opening-night-jersey-party',
        title: 'Opening Night Jersey Party',
        description:
            'Kick off World Cup 2026 with the loudest opening night in town. Wear your country\'s jersey, hit the photo booth, and stay for the after-party at a partner venue.',
        defaultPrizes: [
            { tier: 'Grand prize', prize: 'Best Jersey of the Night — $250 venue tab' },
            { tier: 'Runner-up', prize: 'Free pitcher + appetizer' },
        ],
        defaultTags: ['JERSEY_PARTY', 'OPENING_NIGHT', 'WORLD_CUP_2026'],
        defaultBookingNotes:
            'Doors open 90 minutes before kickoff. Jerseys strongly encouraged. Photo booth open all night. After-party location announced at halftime.',
        defaultContestRules:
            'Most-photographed jersey wins via crowd vote. Vote ends at 60th minute. Winner announced at full time. One vote per attendee.',
        category: 'tournament-opening',
        sortOrder: 10,
    },
    {
        slug: 'usa-jersey-night',
        title: 'USA Jersey Night',
        description:
            'Every USA group-stage match. Stars and Stripes encouraged. House DJ runs USMNT chants between possessions.',
        defaultPrizes: [
            { tier: 'Best dressed', prize: 'Free round for your table' },
            { tier: 'Goal scorer pool', prize: 'Free entrée on USA\'s next match' },
        ],
        defaultTags: ['JERSEY_PARTY', 'USA', 'COUNTRY_NIGHT'],
        defaultBookingNotes:
            'Doors open 60 minutes pre-match. USMNT jerseys, scarves, and face paint welcome. Goal-celebration shots on the house.',
        defaultContestRules:
            'Goal-prediction pool: write down the first USA scorer before kickoff. All correct entries split a free entrée draw.',
        category: 'country-night',
        sortOrder: 20,
    },
    {
        slug: 'mexico-jersey-night',
        title: 'Mexico Jersey Night',
        description: 'El Tri match days — verde, blanco, rojo all night. Mariachi-style halftime entertainment.',
        defaultPrizes: [
            { tier: 'Best dressed', prize: 'Free pitcher of Modelo' },
            { tier: 'Chant champion', prize: 'House-tab voucher — $50' },
        ],
        defaultTags: ['JERSEY_PARTY', 'MEXICO', 'COUNTRY_NIGHT'],
        defaultBookingNotes:
            'El Tri jerseys welcome. Halftime mariachi or Latin DJ set. Taco specials all match.',
        defaultContestRules:
            'Loudest chant at halftime wins the house-tab voucher. Crowd-decibel judged by staff.',
        category: 'country-night',
        sortOrder: 30,
    },
    {
        slug: 'brazil-jersey-night',
        title: 'Brazil Jersey Night',
        description: 'Seleção takeover. Yellow + green everywhere, samba between halves.',
        defaultPrizes: [
            { tier: 'Best samba', prize: 'Caipirinha pitcher on the house' },
            { tier: 'Best dressed', prize: 'Free entrée' },
        ],
        defaultTags: ['JERSEY_PARTY', 'BRAZIL', 'COUNTRY_NIGHT'],
        defaultBookingNotes:
            'Brazilian flag colors welcome. Samba DJ between halves. Brazilian-themed specials.',
        defaultContestRules:
            'Halftime samba contest — best dancer judged by crowd cheer. One entry per attendee.',
        category: 'country-night',
        sortOrder: 40,
    },
    {
        slug: 'argentina-jersey-night',
        title: 'Argentina Jersey Night',
        description: 'Albiceleste takeover. Blue + white, Messi tribute reel, tango set at halftime.',
        defaultPrizes: [
            { tier: 'Best dressed', prize: 'Malbec on the house' },
            { tier: 'Trivia winner', prize: 'House-tab voucher — $50' },
        ],
        defaultTags: ['JERSEY_PARTY', 'ARGENTINA', 'COUNTRY_NIGHT'],
        defaultBookingNotes:
            'Albiceleste jerseys welcome. Argentine wine + asado specials. Halftime trivia round.',
        defaultContestRules:
            'Halftime Argentina-soccer trivia (10 questions). Highest score wins the voucher; ties broken by speed.',
        category: 'country-night',
        sortOrder: 50,
    },
    {
        slug: 'international-fan-night',
        title: 'International Fan Night',
        description:
            'Bring your country\'s jersey — any nation, any era. Prizes for most-represented nation and rarest jersey in the room.',
        defaultPrizes: [
            { tier: 'Most-represented nation', prize: 'Free pitcher for the whole nation\'s table' },
            { tier: 'Rarest jersey', prize: 'Free entrée + house shoutout' },
        ],
        defaultTags: ['JERSEY_PARTY', 'INTERNATIONAL', 'COMMUNITY'],
        defaultBookingNotes:
            'Any country welcome — historic kits encouraged. Flag drop-zone by the entrance. Country-themed cocktails rotate.',
        defaultContestRules:
            'Head count by nation at the 30th minute determines the most-represented prize. Rarest-jersey judged by venue staff.',
        category: 'community-night',
        sortOrder: 60,
    },
    {
        slug: 'retro-jersey-night',
        title: 'Retro Soccer Jersey Night',
        description:
            'Vintage kits only — anything pre-2000 scores extra. Throwback drinks menu + 90s soccer highlights between halves.',
        defaultPrizes: [
            { tier: 'Most vintage jersey', prize: '$100 house tab' },
            { tier: 'Best 90s drink order', prize: 'Free shot for the table' },
        ],
        defaultTags: ['JERSEY_PARTY', 'RETRO', 'THROWBACK'],
        defaultBookingNotes:
            'Vintage soccer kits only — pre-2010 preferred, pre-2000 wins prizes. Throwback drinks menu all night.',
        defaultContestRules:
            'Staff judges most-vintage jersey at 60th minute by year + condition + obscurity.',
        category: 'themed-night',
        sortOrder: 70,
    },
    {
        slug: 'best-jersey-contest',
        title: 'Best Jersey Contest',
        description:
            'Weekly contest across the tournament. Photo entries posted to the venue\'s socials; community votes pick the winner.',
        defaultPrizes: [
            { tier: 'Weekly winner', prize: '$150 house tab + featured on socials' },
            { tier: 'Final tournament winner', prize: 'Signed jersey + premium table for the Final' },
        ],
        defaultTags: ['JERSEY_PARTY', 'CONTEST', 'SOCIAL'],
        defaultBookingNotes:
            'Photo booth on every match day. Enter the weekly contest by snapping at the booth and tagging the venue.',
        defaultContestRules:
            'Weekly winners chosen by Instagram engagement (likes + comments) by Sunday midnight. Final winner crowned the morning of July 19.',
        category: 'tournament-long',
        sortOrder: 80,
    },
    {
        slug: 'family-fan-night',
        title: 'Family Fan Night',
        description:
            'Kid-friendly viewing — early kickoff slots only. Soccer-themed activities, mocktails, kids menu.',
        defaultPrizes: [
            { tier: 'Kids penalty-shoot competition', prize: 'Free dessert + jersey raffle entry' },
        ],
        defaultTags: ['FAMILY', 'KID_FRIENDLY', 'EARLY_KICKOFF'],
        defaultBookingNotes:
            'Open to families during 11am – 4pm kickoffs only. Kids menu + soccer activity table. Mocktail flight available.',
        defaultContestRules:
            'Kids-only penalty shootout at halftime. Foam ball, soft goal. Every participant gets a raffle ticket.',
        category: 'community-night',
        sortOrder: 90,
    },
    {
        slug: 'corporate-fan-night',
        title: 'Corporate Fan Night',
        description:
            'Private buyout for company watch parties. Branded sign-in, custom menu, dedicated server. Bundles 20–100 guests.',
        defaultPrizes: [],
        defaultTags: ['CORPORATE', 'PRIVATE_EVENT', 'GROUP_BOOKING'],
        defaultBookingNotes:
            'Private buyout — minimum 20 guests. Custom F&B menu, branded sign-in, dedicated server team. Book 14+ days ahead for finals weekend.',
        defaultContestRules: '',
        category: 'private-event',
        sortOrder: 100,
    },
];

async function main() {
    console.log(`\n🎽  Seeding ${TEMPLATES.length} jersey-party campaign templates\n`);

    let inserted = 0;

    for (const t of TEMPLATES) {
        const result = await db
            .insert(campaignTemplates)
            .values({
                slug: t.slug,
                title: t.title,
                description: t.description,
                defaultPrizes: t.defaultPrizes,
                defaultTags: t.defaultTags,
                defaultBookingNotes: t.defaultBookingNotes,
                defaultContestRules: t.defaultContestRules,
                category: t.category,
                sortOrder: t.sortOrder,
                isActive: true,
            })
            .onConflictDoUpdate({
                target: campaignTemplates.slug,
                set: {
                    title: t.title,
                    description: t.description,
                    defaultPrizes: t.defaultPrizes,
                    defaultTags: t.defaultTags,
                    defaultBookingNotes: t.defaultBookingNotes,
                    defaultContestRules: t.defaultContestRules,
                    category: t.category,
                    sortOrder: t.sortOrder,
                    updatedAt: sql`now()`,
                },
            })
            .returning({ id: campaignTemplates.id, slug: campaignTemplates.slug });

        if (result.length > 0) {
            console.log(`  ✓ ${t.slug}`);
            // We can't easily tell insert vs update from onConflictDoUpdate's return,
            // so we treat all as successful upserts.
            inserted++;
        }
    }

    console.log(`\n────────────────────────────────────────`);
    console.log(`Upserted: ${inserted}  (idempotent — re-running is safe)`);
    console.log(`────────────────────────────────────────\n`);

    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
