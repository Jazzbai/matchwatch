import 'dotenv/config';
import { db } from '../db/client.js';
import { venues } from '../db/schema.js';
import { sql } from 'drizzle-orm';

async function main() {
    const all = await db.select().from(venues).where(
        sql`metadata->>'importedPlaceId' IS NOT NULL`
    );

    const BAR_TYPES = ['bar', 'night_club', 'restaurant', 'food', 'cafe'];

    const results = all.map((v) => {
        const meta = v.metadata as any;
        const googleTypes: string[] = meta?.googleTypes ?? [];
        const galleryUrls: string[] = meta?.galleryUrls ?? [];

        const isRealVenue = googleTypes.some((t: string) => BAR_TYPES.includes(t));
        const hasDescription = Boolean(v.description);
        const hasCover = Boolean(v.coverImageUrl);
        const hasGallery = galleryUrls.length > 0;
        const hasPhone = Boolean(v.phone);
        const hasWebsite = Boolean(v.website);

        // Flag junk: no bar type AND no description
        const isJunk = !isRealVenue;

        return {
            name: v.name,
            city: v.city,
            address: v.addressLine1,
            rating: v.averageRating,
            totalReviews: v.totalReviews,
            phone: v.phone ?? '—',
            website: v.website ?? '—',
            googleTypes: googleTypes.join(', ') || 'NONE',
            description: v.description ? v.description.slice(0, 80) + '...' : '—',
            hasCover,
            hasGallery,
            galleryCount: galleryUrls.length,
            isRealVenue,
            isJunk,
            // Issues list
            issues: [
                !isRealVenue && 'NOT_A_BAR',
                !hasDescription && 'NO_DESCRIPTION',
                !hasCover && 'NO_COVER_PHOTO',
                !hasPhone && 'NO_PHONE',
                !hasWebsite && 'NO_WEBSITE',
            ].filter(Boolean) as string[],
        };
    });

    // Sort: junk first, then by issues count
    results.sort((a, b) => {
        if (a.isJunk !== b.isJunk) return a.isJunk ? -1 : 1;
        return b.issues.length - a.issues.length;
    });

    // ── Print full audit table ────────────────────────────────────────────
    console.log('\n🔍  VENUE AUDIT REPORT');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log(`Total imported venues: ${results.length}`);
    const junk = results.filter(r => r.isJunk);
    const clean = results.filter(r => !r.isJunk);
    console.log(`  ✅  Real bars/restaurants: ${clean.length}`);
    console.log(`  ❌  Junk (not a bar):       ${junk.length}`);
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    // ── JUNK section ─────────────────────────────────────────────────────
    if (junk.length) {
        console.log('❌  JUNK VENUES (should be deleted):');
        console.log('─'.repeat(80));
        for (const v of junk) {
            console.log(`  ${v.name} | ${v.city}`);
            console.log(`    Types: ${v.googleTypes}`);
            console.log(`    Issues: ${v.issues.join(', ')}`);
        }
        console.log();
    }

    // ── REAL VENUES audit ─────────────────────────────────────────────────
    console.log('✅  REAL VENUES — DATA QUALITY:');
    console.log('─'.repeat(80));

    let perfectCount = 0;
    for (const v of clean) {
        const status = v.issues.length === 0 ? '✅ COMPLETE' : `⚠️  ISSUES: ${v.issues.join(', ')}`;
        if (v.issues.length === 0) perfectCount++;
        console.log(`\n  ${v.name} | ${v.city}`);
        console.log(`    Address:   ${v.address}`);
        console.log(`    Rating:    ⭐ ${v.rating} (${v.totalReviews} reviews)`);
        console.log(`    Types:     ${v.googleTypes}`);
        console.log(`    Phone:     ${v.phone}`);
        console.log(`    Website:   ${v.website}`);
        console.log(`    Photos:    Cover=${v.hasCover ? '✅' : '❌'} Gallery=${v.galleryCount}`);
        console.log(`    Desc:      ${v.description}`);
        console.log(`    Status:    ${status}`);
    }

    // ── Summary scoreboard ────────────────────────────────────────────────
    console.log('\n\n📊  DATA QUALITY SCOREBOARD');
    console.log('═══════════════════════════════════════════════════════════');

    const issueMap: Record<string, number> = {};
    for (const v of clean) {
        for (const issue of v.issues) {
            issueMap[issue] = (issueMap[issue] ?? 0) + 1;
        }
    }

    console.log(`  Perfect (no issues):  ${perfectCount}/${clean.length}`);
    for (const [issue, count] of Object.entries(issueMap).sort((a,b) => b[1]-a[1])) {
        console.log(`  ${issue.padEnd(20)} ${count} venues`);
    }

    // ── Gallery URL issue ─────────────────────────────────────────────────
    console.log('\n⚠️  API ISSUE DETECTED:');
    console.log('  galleryImageUrls is always [] in the API response.');
    console.log('  Photos are stored in metadata.galleryUrls but the venues');
    console.log('  route is reading galleryS3Keys instead.');
    console.log('  → Fix: map metadata.galleryUrls into the API response.\n');

    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
