/**
 * seedSocialPostTemplates.ts
 *
 * Seeds the 35 World Cup social-media campaign templates from the Sport PBR
 * proposal. Idempotent — uses ON CONFLICT (slug) DO UPDATE.
 *
 * Usage (from monorepo root):
 *   npx tsx apps/api/src/scripts/seedSocialPostTemplates.ts
 *
 * Or in the api container:
 *   docker compose exec api npx tsx /app/apps/api/src/scripts/seedSocialPostTemplates.ts
 */

import { sql } from 'drizzle-orm';
import { db } from '../db/client';
import { socialPostTemplates } from '../db/schema';

type SeedTemplate = {
    slug: string;
    title: string;
    description: string;
    category: 'pre-tournament' | 'match-day' | 'themed' | 'engagement' | 'finals';
    copyTemplate: string;
    placeholders: string[];
    defaultMatchPhase?: string;
    sortOrder: number;
};

const T: SeedTemplate[] = [
    // ─── Pre-tournament (10) ────────────────────────────────────────────
    {
        slug: 'opening-match-countdown',
        title: 'Opening Match Countdown',
        description: 'Build hype in the days before the WC kickoff.',
        category: 'pre-tournament',
        copyTemplate:
            "{days} days until World Cup 2026 kicks off. Don't miss a single match — every game on the big screens at {venue}. Save your table now.",
        placeholders: ['days', 'venue'],
        defaultMatchPhase: 'pre-tournament',
        sortOrder: 10,
    },
    {
        slug: 'meet-your-team',
        title: 'Meet Your Team',
        description: 'Spotlight a featured national team ahead of their group stage.',
        category: 'pre-tournament',
        copyTemplate:
            "Meet {country} 🌍 — playing their first World Cup match on {date}. Wearing their jersey? Free shot on us. Reserve your spot at {venue}.",
        placeholders: ['country', 'date', 'venue'],
        defaultMatchPhase: 'pre-tournament',
        sortOrder: 20,
    },
    {
        slug: 'soccer-trivia-night',
        title: 'Soccer Trivia Night',
        description: 'Pre-tournament trivia night to build crowd familiarity.',
        category: 'pre-tournament',
        copyTemplate:
            "World Cup Trivia Night at {venue} — {date} at {time}. Test your soccer IQ. Winning team takes home {prize}. Free to enter. Sign up at the bar.",
        placeholders: ['venue', 'date', 'time', 'prize'],
        defaultMatchPhase: 'pre-tournament',
        sortOrder: 30,
    },
    {
        slug: 'world-cup-bracket-challenge',
        title: 'World Cup Bracket Challenge',
        description: 'Tournament-long bracket prediction contest.',
        category: 'pre-tournament',
        copyTemplate:
            "Build your bracket. Win {prize}. Free to enter our {venue} World Cup bracket challenge — submit your picks before {deadline}. Winner takes home the prize at the Final.",
        placeholders: ['prize', 'venue', 'deadline'],
        defaultMatchPhase: 'pre-tournament',
        sortOrder: 40,
    },
    {
        slug: 'dj-pre-game-party',
        title: 'DJ Pre-Game Party',
        description: 'DJ set leading into a marquee match.',
        category: 'pre-tournament',
        copyTemplate:
            "Pre-game DJ set at {venue} — {dj} starts {time} before {team1} vs {team2}. Get there early, claim a booth, stay for kickoff.",
        placeholders: ['venue', 'dj', 'time', 'team1', 'team2'],
        defaultMatchPhase: 'match-day',
        sortOrder: 50,
    },
    {
        slug: 'meet-local-soccer-clubs',
        title: 'Meet Local Soccer Clubs',
        description: 'Local club partnership night.',
        category: 'pre-tournament',
        copyTemplate:
            "{venue} 🤝 {club}. Local soccer night — meet the team, get jersey discounts, and watch World Cup matches with fellow supporters. {date}.",
        placeholders: ['venue', 'club', 'date'],
        defaultMatchPhase: 'pre-tournament',
        sortOrder: 60,
    },
    // ─── Match day (8) ──────────────────────────────────────────────────
    {
        slug: 'goal-prediction-contest',
        title: 'Goal Prediction Contest',
        description: 'Pre-match prediction game with a free F&B prize.',
        category: 'match-day',
        copyTemplate:
            "Predict the score: {team1} vs {team2}. Closest guess at {venue} wins {prize}. Drop your prediction at the bar before kickoff — {time} kickoff.",
        placeholders: ['team1', 'team2', 'venue', 'prize', 'time'],
        defaultMatchPhase: 'match-day',
        sortOrder: 110,
    },
    {
        slug: 'first-goal-giveaway',
        title: 'First Goal Giveaway',
        description: 'Free drink for the table when the first goal goes in.',
        category: 'match-day',
        copyTemplate:
            "{team1} vs {team2} at {venue} — first goal of the match = {prize} on the house for every table. Doors {doors}, kickoff {kickoff}.",
        placeholders: ['team1', 'team2', 'venue', 'prize', 'doors', 'kickoff'],
        defaultMatchPhase: 'match-day',
        sortOrder: 120,
    },
    {
        slug: 'free-appetizer-promotion',
        title: 'Free Appetizer Promotion',
        description: 'Reservation-driver appetizer offer.',
        category: 'match-day',
        copyTemplate:
            "Book a table for {team1} vs {team2} at {venue}, get a free {appetizer} on us. Online reservation, walk-ins limited. {kickoff} kickoff.",
        placeholders: ['team1', 'team2', 'venue', 'appetizer', 'kickoff'],
        defaultMatchPhase: 'match-day',
        sortOrder: 130,
    },
    {
        slug: 'happy-hour-match',
        title: 'Happy Hour Match',
        description: 'Match-tied happy hour deal.',
        category: 'match-day',
        copyTemplate:
            "World Cup Happy Hour for {team1} vs {team2} — {discount} off all drafts and shareables at {venue}. Runs through the final whistle.",
        placeholders: ['team1', 'team2', 'discount', 'venue'],
        defaultMatchPhase: 'match-day',
        sortOrder: 140,
    },
    {
        slug: 'vip-table-promotion',
        title: 'VIP Table Promotion',
        description: 'Premium reservation push for marquee matches.',
        category: 'match-day',
        copyTemplate:
            "VIP for {team1} vs {team2}: reserved booth, bottle service, dedicated server — only {seats} VIP tables at {venue}. Book before they're gone.",
        placeholders: ['team1', 'team2', 'seats', 'venue'],
        defaultMatchPhase: 'match-day',
        sortOrder: 150,
    },
    {
        slug: 'halftime-giveaway',
        title: 'Halftime Giveaway',
        description: 'Halftime draw to keep guests engaged.',
        category: 'match-day',
        copyTemplate:
            "🎁 Halftime giveaway at {venue} — every guest at the bar at halftime of {team1} vs {team2} enters the draw to win {prize}. Stay for halftime.",
        placeholders: ['venue', 'team1', 'team2', 'prize'],
        defaultMatchPhase: 'match-day',
        sortOrder: 160,
    },
    {
        slug: 'pick-the-winner',
        title: 'Pick the Winner',
        description: 'Simple match-day winner pool.',
        category: 'match-day',
        copyTemplate:
            "Pick the winner: {team1} or {team2}? Correct picks at {venue} go in the draw for {prize}. Drop your pick at the bar before {kickoff}.",
        placeholders: ['team1', 'team2', 'venue', 'prize', 'kickoff'],
        defaultMatchPhase: 'match-day',
        sortOrder: 170,
    },
    {
        slug: 'post-match-celebration',
        title: 'Post-Match Celebration',
        description: 'Late-night celebration after a marquee result.',
        category: 'match-day',
        copyTemplate:
            "🎉 Stay for the celebration after {team1} vs {team2}. DJ set, drink specials, and post-match buffet at {venue} until close.",
        placeholders: ['team1', 'team2', 'venue'],
        defaultMatchPhase: 'match-day',
        sortOrder: 180,
    },
    // ─── Themed nights (8) ──────────────────────────────────────────────
    {
        slug: 'jersey-contest',
        title: 'Jersey Contest',
        description: 'Photo-based weekly jersey contest.',
        category: 'themed',
        copyTemplate:
            "Wear your jersey to {venue} tonight — snap a pic at the booth, tag us, win {prize}. Best jersey of the week wins the big prize at the Final.",
        placeholders: ['venue', 'prize'],
        defaultMatchPhase: 'match-day',
        sortOrder: 210,
    },
    {
        slug: 'country-pride-night',
        title: 'Country Pride Night',
        description: 'National-team takeover night.',
        category: 'themed',
        copyTemplate:
            "🇺🇸 {country} Pride Night at {venue} — flags, jerseys, chants. {country} match at {time}. Themed menu + house DJ. Free entry, reservations recommended.",
        placeholders: ['country', 'venue', 'time'],
        defaultMatchPhase: 'match-day',
        sortOrder: 220,
    },
    {
        slug: 'international-food-night',
        title: 'International Food Night',
        description: 'Match-tied menu featuring one country\'s cuisine.',
        category: 'themed',
        copyTemplate:
            "Tonight at {venue}: {cuisine} menu for {team1} vs {team2}. Authentic dishes, paired drinks, all match long. Kickoff {kickoff}.",
        placeholders: ['venue', 'cuisine', 'team1', 'team2', 'kickoff'],
        defaultMatchPhase: 'match-day',
        sortOrder: 230,
    },
    {
        slug: 'ladies-soccer-night',
        title: 'Ladies Soccer Night',
        description: 'Women-focused match-day promotion.',
        category: 'themed',
        copyTemplate:
            "Ladies night at {venue} — {team1} vs {team2}. {discount} off select drinks for ladies, themed photo booth, post-match karaoke. {kickoff} kickoff.",
        placeholders: ['venue', 'team1', 'team2', 'discount', 'kickoff'],
        defaultMatchPhase: 'match-day',
        sortOrder: 240,
    },
    {
        slug: 'kids-fan-day',
        title: 'Kids Fan Day',
        description: 'Family-friendly early-kickoff event.',
        category: 'themed',
        copyTemplate:
            "Family viewing at {venue} for {team1} vs {team2} — kids menu, soccer activities, mocktails. {time} kickoff. Family tables limited, reserve early.",
        placeholders: ['venue', 'team1', 'team2', 'time'],
        defaultMatchPhase: 'match-day',
        sortOrder: 250,
    },
    {
        slug: 'youth-soccer-night',
        title: 'Youth Soccer Night',
        description: 'Youth-league partnership night.',
        category: 'themed',
        copyTemplate:
            "{venue} 🤝 {league}. Bring your youth-team jersey, get free apps. World Cup match on every screen, kids' tournament-style activities all night.",
        placeholders: ['venue', 'league'],
        defaultMatchPhase: 'match-day',
        sortOrder: 260,
    },
    {
        slug: 'alumni-night',
        title: 'Alumni Night',
        description: 'College/club alumni group meetup.',
        category: 'themed',
        copyTemplate:
            "{school}/{club} alumni — meet at {venue} for {team1} vs {team2}. Reserved section, alumni drink special, raffle for {prize}.",
        placeholders: ['school', 'club', 'venue', 'team1', 'team2', 'prize'],
        defaultMatchPhase: 'match-day',
        sortOrder: 270,
    },
    {
        slug: 'birthday-during-world-cup',
        title: 'Birthday During World Cup',
        description: 'Birthday party package tied to a specific match.',
        category: 'themed',
        copyTemplate:
            "Birthday during the World Cup? Book your party at {venue} for the {team1} vs {team2} match — reserved table, free dessert, custom jersey numbered for the birthday VIP.",
        placeholders: ['venue', 'team1', 'team2'],
        defaultMatchPhase: 'match-day',
        sortOrder: 280,
    },
    // ─── Engagement (9) ─────────────────────────────────────────────────
    {
        slug: 'fan-photo-contest',
        title: 'Fan Photo Contest',
        description: 'User-generated photo contest.',
        category: 'engagement',
        copyTemplate:
            "Snap your match-day photo at {venue}, tag us with #{hashtag}. Best photo of the week wins {prize}. Tournament-long winner gets a Final-night booth.",
        placeholders: ['venue', 'hashtag', 'prize'],
        defaultMatchPhase: 'match-day',
        sortOrder: 310,
    },
    {
        slug: 'best-dressed-fan',
        title: 'Best Dressed Fan',
        description: 'In-venue best-dressed contest.',
        category: 'engagement',
        copyTemplate:
            "Best dressed fan at {venue} tonight wins {prize}. Jerseys, scarves, face paint — go all in. Winner crowned at halftime.",
        placeholders: ['venue', 'prize'],
        defaultMatchPhase: 'match-day',
        sortOrder: 320,
    },
    {
        slug: 'corporate-watch-party',
        title: 'Corporate Watch Party',
        description: 'B2B private buyout promotion.',
        category: 'engagement',
        copyTemplate:
            "Run a watch party for your team. {venue} private buyout — {team1} vs {team2}, custom menu, branded sign-in, dedicated server. Inquire today.",
        placeholders: ['venue', 'team1', 'team2'],
        defaultMatchPhase: 'match-day',
        sortOrder: 330,
    },
    {
        slug: 'group-package-promotion',
        title: 'Group Package Promotion',
        description: 'Group-of-N reservation push.',
        category: 'engagement',
        copyTemplate:
            "Group of {n}+? Pre-set F&B at {venue} for {team1} vs {team2} — pitcher + shareables, guaranteed table. Book today.",
        placeholders: ['n', 'venue', 'team1', 'team2'],
        defaultMatchPhase: 'match-day',
        sortOrder: 340,
    },
    {
        slug: 'sponsor-giveaway',
        title: 'Sponsor Giveaway',
        description: 'Sponsor-funded prize push.',
        category: 'engagement',
        copyTemplate:
            "🎁 Brought to you by {sponsor}: win {prize} at {venue} for {team1} vs {team2}. Enter at the bar. Drawing at halftime.",
        placeholders: ['sponsor', 'prize', 'venue', 'team1', 'team2'],
        defaultMatchPhase: 'match-day',
        sortOrder: 350,
    },
    {
        slug: 'vip-experience-giveaway',
        title: 'VIP Experience Giveaway',
        description: 'High-touch VIP draw to drive social shares.',
        category: 'engagement',
        copyTemplate:
            "Win the VIP Final experience at {venue}: reserved booth, bottle service, post-match private party. Share + tag to enter — draw on {date}.",
        placeholders: ['venue', 'date'],
        defaultMatchPhase: 'pre-tournament',
        sortOrder: 360,
    },
    {
        slug: 'business-networking-match',
        title: 'Business Networking Match',
        description: 'B2B networking event during a match.',
        category: 'engagement',
        copyTemplate:
            "{industry} networking at {venue} — {team1} vs {team2}. 90 minutes of soccer + 90 minutes of pitches. {fee} entry, {includes}.",
        placeholders: ['industry', 'venue', 'team1', 'team2', 'fee', 'includes'],
        defaultMatchPhase: 'match-day',
        sortOrder: 370,
    },
    {
        slug: 'influencer-night',
        title: 'Influencer Night',
        description: 'Creator/influencer takeover.',
        category: 'engagement',
        copyTemplate:
            "{influencer} takes over {venue} for {team1} vs {team2} — live content, signature drink, photo wall. Doors {doors}, kickoff {kickoff}.",
        placeholders: ['influencer', 'venue', 'team1', 'team2', 'doors', 'kickoff'],
        defaultMatchPhase: 'match-day',
        sortOrder: 380,
    },
    // ─── Knockout & finals (6) ──────────────────────────────────────────
    {
        slug: 'golden-boot-contest',
        title: 'Golden Boot Contest',
        description: 'Tournament-long top-scorer prediction.',
        category: 'finals',
        copyTemplate:
            "Who wins the Golden Boot? Submit your pick at {venue} before {deadline}. Correct picks split {prize}. Drawing at the Final.",
        placeholders: ['venue', 'deadline', 'prize'],
        defaultMatchPhase: 'pre-tournament',
        sortOrder: 410,
    },
    {
        slug: 'final-countdown',
        title: 'Final Countdown',
        description: 'Push hard for the Final.',
        category: 'finals',
        copyTemplate:
            "{days} days to the World Cup Final 🏆 — {venue} is opening at {doors}, doors close when we hit capacity. Lock your table now.",
        placeholders: ['days', 'venue', 'doors'],
        defaultMatchPhase: 'finals',
        sortOrder: 420,
    },
    {
        slug: 'semifinal-special',
        title: 'Semifinal Special',
        description: 'Semifinal-night reservation push.',
        category: 'finals',
        copyTemplate:
            "Semifinal night at {venue} — {team1} vs {team2}. Reserved booths still open. {kickoff} kickoff. Don't miss the highest-stakes match before the Final.",
        placeholders: ['venue', 'team1', 'team2', 'kickoff'],
        defaultMatchPhase: 'finals',
        sortOrder: 430,
    },
    {
        slug: 'championship-weekend',
        title: 'Championship Weekend',
        description: 'Weekend-pass concept for the closing rounds.',
        category: 'finals',
        copyTemplate:
            "Championship Weekend at {venue} — 3rd-place playoff + Final, both days. Weekend pass: reserved seat, F&B credit, party hat included.",
        placeholders: ['venue'],
        defaultMatchPhase: 'finals',
        sortOrder: 440,
    },
    {
        slug: 'closing-celebration-party',
        title: 'Closing Celebration Party',
        description: 'Post-Final closing party.',
        category: 'finals',
        copyTemplate:
            "Tournament's over — let's celebrate. {venue} closing party {date}: DJ, championship recap reel, tournament-long contest winners announced.",
        placeholders: ['venue', 'date'],
        defaultMatchPhase: 'finals',
        sortOrder: 450,
    },
];

async function main() {
    console.log(`\n📣  Seeding ${T.length} social-post campaign templates\n`);

    let upserted = 0;
    for (const t of T) {
        const result = await db
            .insert(socialPostTemplates)
            .values({
                slug: t.slug,
                title: t.title,
                description: t.description,
                category: t.category,
                copyTemplate: t.copyTemplate,
                placeholders: t.placeholders,
                defaultMatchPhase: t.defaultMatchPhase,
                sortOrder: t.sortOrder,
                isActive: true,
            })
            .onConflictDoUpdate({
                target: socialPostTemplates.slug,
                set: {
                    title: t.title,
                    description: t.description,
                    category: t.category,
                    copyTemplate: t.copyTemplate,
                    placeholders: t.placeholders,
                    defaultMatchPhase: t.defaultMatchPhase,
                    sortOrder: t.sortOrder,
                    updatedAt: sql`now()`,
                },
            })
            .returning({ slug: socialPostTemplates.slug });
        if (result.length > 0) {
            console.log(`  ✓ ${t.category.padEnd(16)} ${t.slug}`);
            upserted++;
        }
    }

    console.log(`\n────────────────────────────────────────`);
    console.log(`Upserted: ${upserted}  (idempotent — re-running is safe)`);
    console.log(`────────────────────────────────────────\n`);

    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
