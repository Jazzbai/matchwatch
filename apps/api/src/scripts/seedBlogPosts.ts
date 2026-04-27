import 'dotenv/config';
import { db } from "../db/client.js";
import { blogCategories, blogPosts, blogPostCategories, users } from "../db/schema.js";
import { eq, or } from "drizzle-orm";

async function main() {
    // Find an admin/owner user to be the author
    const [author] = await db
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.role, 'SUPER_ADMIN'), eq(users.role, 'ADMIN'), eq(users.role, 'VENUE_OWNER')))
        .limit(1);

    if (!author) {
        console.error("No admin/venue owner user found. Run mls_seed.sql first.");
        process.exit(1);
    }

    console.log("Using author ID:", author.id);

    // Seed categories
    const cats = await db
        .insert(blogCategories)
        .values([
            { name: "Fan Guides", slug: "fan-guides", description: "Tips and guides for match day fans", sortOrder: 1 },
            { name: "Venue Features", slug: "venue-features", description: "Spotlights on top watch party venues", sortOrder: 2 },
            { name: "Match Previews", slug: "match-previews", description: "What to expect from upcoming fixtures", sortOrder: 3 },
            { name: "Travel Notes", slug: "travel-notes", description: "Getting around for watch parties", sortOrder: 4 },
        ])
        .onConflictDoNothing()
        .returning({ id: blogCategories.id, slug: blogCategories.slug });

    // Fetch all categories by slug for reference
    const allCats = await db.select({ id: blogCategories.id, slug: blogCategories.slug }).from(blogCategories);
    const catMap: Record<string, string> = {};
    for (const c of allCats) catMap[c.slug] = c.id;

    console.log("Categories:", Object.keys(catMap));

    const now = new Date();

    // Seed posts
    const posts = await db
        .insert(blogPosts)
        .values([
            {
                authorId: author.id,
                title: "The Best Watch Party Venues in Houston for MLS Matches",
                slug: "best-watch-party-venues-houston-mls",
                excerpt: "Houston's sports bar scene has exploded with Dynamo fever. Here are our top picks for catching the action with fellow fans.",
                featuredImageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80",
                contentHtml: `<p>Houston is home to one of MLS's most passionate fan bases, and the city's watch party scene reflects that energy. Whether you're a die-hard Dynamo supporter or just getting into MLS soccer, these venues deliver the full match-day experience.</p>
<h2>What Makes a Great Watch Party Venue?</h2>
<p>The best venues combine three things: big screens, great atmosphere, and food that doesn't quit at halftime. We've scoured Houston's bars and restaurants to bring you our definitive list.</p>
<h2>Top Picks</h2>
<p><strong>Sports bars near downtown</strong> tend to have the most screens and the loudest crowds. Look for venues with dedicated soccer sections — many now have supporters' groups that watch together every match day.</p>
<p>For MLS Cup Playoffs, venues fill up fast. Use Matchwatch to reserve your spot in advance and avoid the crush at the door.</p>
<h2>Tips for Match Day</h2>
<ul>
<li>Arrive 30 minutes early to secure a good view of the main screen</li>
<li>Check if the venue has a dedicated supporters' section</li>
<li>Book ahead for Champions League overlay nights — they get packed</li>
</ul>
<p>Ready to find your spot? Browse venues on Matchwatch and reserve before kickoff.</p>`,
                status: 'PUBLISHED' as const,
                publishedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            },
            {
                authorId: author.id,
                title: "Champions League Final Watch Parties: Where to Watch in the US",
                slug: "champions-league-final-watch-parties-us",
                excerpt: "The biggest club match of the year deserves the best setting. Here's how to find a Champions League final watch party near you.",
                featuredImageUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80",
                contentHtml: `<p>Every May, football fans across America wake up early (or stay up late) to watch the UEFA Champions League Final. It's become one of the most-watched sporting events in the United States, and the watch party scene has grown to match.</p>
<h2>Early Kickoffs Mean Early Starts</h2>
<p>Champions League finals typically kick off around 3:00 PM Central European Time — that's 9 AM or 10 AM on the East Coast. Many bars open early for these fixtures, serving breakfast alongside the match.</p>
<h2>Finding the Right Venue</h2>
<p>The best Champions League watch parties aren't just bars with the game on — they're full experiences. Look for venues that:</p>
<ul>
<li>Open at least an hour before kickoff</li>
<li>Serve food during the match (not just after)</li>
<li>Have a crowd that actually cares about the game</li>
<li>Stream in HD with good audio</li>
</ul>
<h2>Book Ahead — These Fill Fast</h2>
<p>Champions League final watch parties are among the most in-demand events of the soccer calendar. Use Matchwatch to find venues hosting the final in your city and lock in your spot early.</p>`,
                status: 'PUBLISHED' as const,
                publishedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
            },
            {
                authorId: author.id,
                title: "World Cup 2026: Planning Your Watch Party Season",
                slug: "world-cup-2026-watch-party-planning",
                excerpt: "With the World Cup coming to North America in 2026, now is the time to start planning your watch party calendar. Here's what you need to know.",
                featuredImageUrl: "https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=800&q=80",
                contentHtml: `<p>The 2026 FIFA World Cup is the biggest sporting event in history — 48 teams, 104 matches, and it's happening right here in North America. For soccer fans in the US, Canada, and Mexico, this is a once-in-a-generation opportunity to be part of the action.</p>
<h2>The Scale Is Unprecedented</h2>
<p>With more teams and more games than any previous World Cup, the 2026 tournament will run for over a month. That's five weeks of soccer, which means five weeks of watch parties, early morning matches, and unforgettable moments.</p>
<h2>Watch Party Culture Will Explode</h2>
<p>Even for cities not hosting matches, the watch party scene will be electric. Venues across the country are already preparing dedicated spaces, projector setups, and international menu specials to celebrate the tournament.</p>
<h2>How to Use Matchwatch for WC2026</h2>
<p>Matchwatch will list all World Cup fixtures with venues hosting watch parties. You'll be able to:</p>
<ul>
<li>Filter by your favorite national team</li>
<li>Find venues near you hosting group stage games</li>
<li>Book spots in advance for knockout rounds (they will sell out)</li>
<li>Get reminders for key matches</li>
</ul>
<h2>Start Planning Now</h2>
<p>The best venues book out weeks in advance for major tournaments. Create your Matchwatch account today and follow your favorite venues so you're first to know when they publish their World Cup events.</p>`,
                status: 'PUBLISHED' as const,
                publishedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            },
            {
                authorId: author.id,
                title: "5 Things to Look for in a Great Soccer Watch Party Venue",
                slug: "5-things-great-soccer-watch-party-venue",
                excerpt: "Not all sports bars are created equal. Here's our checklist for finding a venue worth your match-day loyalty.",
                featuredImageUrl: "https://images.unsplash.com/photo-1551958219-acbc4e0e1e18?w=800&q=80",
                contentHtml: `<p>You've found the match. You've cleared your schedule. Now you need a venue that won't let you down. Here's what separates a great watch party from a mediocre one.</p>
<h2>1. Screen Quality and Placement</h2>
<p>Nothing kills the atmosphere faster than a blurry stream on a 32-inch TV mounted in the corner. Great venues invest in large, properly positioned screens so every seat has a good view. Bonus points for projection setups in dedicated soccer rooms.</p>
<h2>2. The Sound Mix</h2>
<p>Stadium audio — the crowd noise, the commentary, the tension — is part of the experience. A venue that plays music over the game audio is missing the point. Find places that turn up the match sound and let the atmosphere breathe.</p>
<h2>3. A Crowd That Cares</h2>
<p>The best watch parties happen with people who are actually invested in the result. Look for venues that host supporters groups or have a reputation for soccer crowds. Check the Matchwatch ratings and reviews to get a feel for the vibe.</p>
<h2>4. Food Worth Eating During 90 Minutes</h2>
<p>You're not going to want to miss a minute of a tight game. Find venues with easy finger food, good drink service, and staff who understand that the kitchen needs to keep up with the match, not compete with it.</p>
<h2>5. Easy Booking and Reserved Spots</h2>
<p>The worst thing is showing up and not getting a seat. Use Matchwatch to find venues that offer advance reservations for watch party events — know your spot is secured before kickoff.</p>`,
                status: 'PUBLISHED' as const,
                publishedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            },
            {
                authorId: author.id,
                title: "Premier League Season Preview: Where to Watch EPL in America",
                slug: "premier-league-season-preview-where-to-watch-epl-america",
                excerpt: "The Premier League is the most-watched soccer league in the US. Here's how to make the most of the new season's watch party circuit.",
                featuredImageUrl: "https://images.unsplash.com/photo-1522778034537-20a2486be803?w=800&q=80",
                contentHtml: `<p>The Premier League's global reach means that in virtually every American city, there's a pub or sports bar filled with passionate fans every Saturday and Sunday morning — and increasingly on weekday evenings too.</p>
<h2>The EPL Watch Party Calendar</h2>
<p>Understanding the EPL schedule is the first step. Most matches kick off at 7:30 AM, 10:00 AM, or 12:30 PM ET on weekends. A handful of mid-week games and European nights add to the schedule.</p>
<p>The big fixtures — Manchester derbies, the North London derby, Merseyside clashes — will be the most in-demand watch party dates of the season. Mark them on your calendar now.</p>
<h2>Finding Your People</h2>
<p>The EPL watch party scene in the US is remarkably well-organized. Official supporter clubs for every major Premier League team exist in most major cities, and they typically have "home pubs" where they watch together.</p>
<p>Matchwatch lists venues hosting EPL fixtures, with filters for amenities, location, and match-day capacity. Find a venue near you and book before the season gets into full swing.</p>
<h2>Tips for the New Season</h2>
<ul>
<li>Subscribe to your favorite venue on Matchwatch to get notified when they publish their EPL hosting schedule</li>
<li>Book the title deciders and relegation battles early — these get packed</li>
<li>Check if venues have deals for recurring subscribers (some pubs offer season passes)</li>
</ul>`,
                status: 'PUBLISHED' as const,
                publishedAt: now,
            },
        ])
        .onConflictDoNothing()
        .returning({ id: blogPosts.id, slug: blogPosts.slug });

    console.log("Inserted posts:", posts.length);

    // Assign categories to posts
    // Re-fetch post IDs by slug in case some already existed
    const allPosts = await db.select({ id: blogPosts.id, slug: blogPosts.slug }).from(blogPosts).where(eq(blogPosts.status, 'PUBLISHED'));
    const postMap: Record<string, string> = {};
    for (const p of allPosts) postMap[p.slug] = p.id;

    const links: { postId: string; categoryId: string }[] = [];

    const add = (postSlug: string, catSlug: string) => {
        const pid = postMap[postSlug];
        const cid = catMap[catSlug];
        if (pid && cid) links.push({ postId: pid, categoryId: cid });
    };

    add("best-watch-party-venues-houston-mls", "venue-features");
    add("best-watch-party-venues-houston-mls", "fan-guides");
    add("champions-league-final-watch-parties-us", "fan-guides");
    add("champions-league-final-watch-parties-us", "match-previews");
    add("world-cup-2026-watch-party-planning", "fan-guides");
    add("world-cup-2026-watch-party-planning", "match-previews");
    add("5-things-great-soccer-watch-party-venue", "fan-guides");
    add("5-things-great-soccer-watch-party-venue", "venue-features");
    add("premier-league-season-preview-where-to-watch-epl-america", "fan-guides");
    add("premier-league-season-preview-where-to-watch-epl-america", "match-previews");

    if (links.length > 0) {
        await db.insert(blogPostCategories).values(links).onConflictDoNothing();
        console.log("Linked categories:", links.length);
    }

    console.log("Blog seed complete.");
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
