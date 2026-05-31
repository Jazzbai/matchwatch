/**
 * optimizeCityImages.ts
 *
 * Re-encodes any image in /public/cities/ to a web-optimized .webp at
 * a sensible card size (1600px wide max, ~78% quality). Keeps aspect ratio,
 * strips metadata, and overwrites/produces <basename>.webp next to the input.
 *
 * Usage (from monorepo root):
 *   npx tsx apps/api/src/scripts/optimizeCityImages.ts
 *   npx tsx apps/api/src/scripts/optimizeCityImages.ts ./HtownKickoff-main/public/cities
 *   npx tsx apps/api/src/scripts/optimizeCityImages.ts --delete-originals
 *
 * Inside the api container:
 *   docker compose exec api npx tsx apps/api/src/scripts/optimizeCityImages.ts /app/HtownKickoff-main/public/cities
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SUPPORTED = new Set(['.jpg', '.jpeg', '.png', '.avif', '.webp', '.tiff', '.gif']);
const MAX_WIDTH = 1600;
const WEBP_QUALITY = 78;

const args = process.argv.slice(2);
const deleteOriginals = args.includes('--delete-originals');
const positional = args.filter((a) => !a.startsWith('--'));
const targetDir = path.resolve(positional[0] || path.join(process.cwd(), 'HtownKickoff-main/public/cities'));

async function fileSize(p: string) {
    try { const s = await fs.stat(p); return s.size; } catch { return 0; }
}

function bytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
    console.log(`\n📸  Optimizing city images in: ${targetDir}\n`);

    let entries: string[];
    try {
        entries = await fs.readdir(targetDir);
    } catch (err) {
        console.error(`Cannot read ${targetDir}:`, (err as Error).message);
        process.exit(1);
    }

    const images = entries.filter((name) => {
        const ext = path.extname(name).toLowerCase();
        return SUPPORTED.has(ext) && !name.startsWith('.');
    });

    if (images.length === 0) {
        console.log('No images found. Drop your files into the cities folder first.');
        return;
    }

    let totalBefore = 0;
    let totalAfter = 0;
    let updated = 0;
    let skipped = 0;
    const removed: string[] = [];

    for (const name of images) {
        const src = path.join(targetDir, name);
        const base = path.basename(name, path.extname(name));
        const dst = path.join(targetDir, `${base}.webp`);
        const before = await fileSize(src);

        try {
            const buf = await sharp(src)
                .rotate()
                .resize({ width: MAX_WIDTH, withoutEnlargement: true })
                .webp({ quality: WEBP_QUALITY })
                .toBuffer();

            // Skip rewrite if the dst already exists and the new buffer wouldn't shrink it meaningfully.
            const dstBefore = await fileSize(dst);
            if (dstBefore > 0 && src.toLowerCase() === dst.toLowerCase() && Math.abs(dstBefore - buf.length) < 1024) {
                console.log(`  •  ${name}  (no meaningful change, skipped)`);
                skipped++;
                totalBefore += before;
                totalAfter += dstBefore;
                continue;
            }

            await fs.writeFile(dst, buf);
            totalBefore += before;
            totalAfter += buf.length;
            updated++;
            console.log(`  ✓  ${name}  ${bytes(before)} → ${path.basename(dst)} ${bytes(buf.length)}`);

            // Optionally remove the non-webp original (keeps the webp).
            if (deleteOriginals && src.toLowerCase() !== dst.toLowerCase()) {
                await fs.unlink(src);
                removed.push(name);
            }
        } catch (err) {
            console.error(`  ✗  ${name}: ${(err as Error).message}`);
        }
    }

    const saved = totalBefore - totalAfter;
    const pct = totalBefore > 0 ? Math.round((saved / totalBefore) * 100) : 0;

    console.log('\n────────────────────────────────────────');
    console.log(`Updated: ${updated}   Skipped: ${skipped}`);
    console.log(`Before:  ${bytes(totalBefore)}`);
    console.log(`After:   ${bytes(totalAfter)}  (${saved >= 0 ? 'saved' : 'grew by'} ${bytes(Math.abs(saved))}, ${pct}%)`);
    if (removed.length > 0) console.log(`Removed originals: ${removed.join(', ')}`);
    if (!deleteOriginals) console.log(`Originals kept. Re-run with --delete-originals to remove non-.webp source files.`);
    console.log('────────────────────────────────────────\n');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
