/**
 * fetchVenueImages.ts
 * Searches Google Places by venue name+city, downloads the photo, uploads to S3,
 * and stores the permanent S3 URL in cover_image_url.
 */

import 'dotenv/config';
import { eq, isNull } from 'drizzle-orm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { db } from '../db/client.js';
import { venues } from '../db/schema.js';

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? '';
const S3_BUCKET = process.env.S3_BUCKET ?? '';
const CDN_URL = (process.env.CDN_URL ?? '').replace(/\/$/, '');
const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';

function parseArgs(argv: string[]): Record<string, string | boolean> {
    const out: Record<string, string | boolean> = {};
    for (const raw of argv) {
        if (!raw.startsWith('--')) continue;
        const [k, v] = raw.slice(2).split('=', 2);
        out[k] = v ?? true;
    }
    return out;
}

const args = parseArgs(process.argv.slice(2));
const DRY_RUN = Boolean(args['dry-run']);
const LIMIT = args['limit'] ? Number(args['limit']) : undefined;

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

const s3 = new S3Client({ region: AWS_REGION });

async function searchPlaceId(name: string, city: string): Promise<string | null> {
    const query = encodeURIComponent(`${name} ${city}`);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json() as any;
    if (data.status !== 'OK' || !data.results?.length) return null;
    return data.results[0].place_id as string;
}

async function getPhotoReference(placeId: string): Promise<string | null> {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json() as any;
    const photos = data.result?.photos;
    if (!photos?.length) return null;
    return photos[0].photo_reference as string;
}

async function downloadPhoto(photoRef: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${photoRef}&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, contentType };
}

function ext(contentType: string): string {
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    return 'jpg';
}

async function uploadToS3(venueId: string, buffer: Buffer, contentType: string): Promise<string> {
    const key = `venue_cover/${venueId}/${Date.now()}.${ext(contentType)}`;
    await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    }));
    return `${CDN_URL}/${key}`;
}

async function main() {
    if (!GOOGLE_API_KEY) throw new Error('Missing GOOGLE_PLACES_API_KEY');
    if (!S3_BUCKET) throw new Error('Missing S3_BUCKET');

    console.log(`\nVenue Image Fetcher (${DRY_RUN ? 'DRY RUN' : 'LIVE'})\n`);

    const allVenues = await db
        .select({ id: venues.id, name: venues.name, city: venues.city })
        .from(venues)
        .where(isNull(venues.coverImageUrl));

    const toProcess = LIMIT ? allVenues.slice(0, LIMIT) : allVenues;
    console.log(`Venues without cover image: ${allVenues.length}, processing: ${toProcess.length}\n`);

    let updated = 0, noResults = 0, errors = 0;

    for (const [i, venue] of toProcess.entries()) {
        process.stdout.write(`[${i + 1}/${toProcess.length}] ${venue.name} (${venue.city}) ... `);
        try {
            const placeId = await searchPlaceId(venue.name, venue.city);
            if (!placeId) { console.log('no search results'); noResults++; await sleep(300); continue; }

            const photoRef = await getPhotoReference(placeId);
            if (!photoRef) { console.log('no photos'); noResults++; await sleep(300); continue; }

            const photo = await downloadPhoto(photoRef);
            if (!photo) { console.log('download failed'); noResults++; await sleep(300); continue; }

            if (DRY_RUN) { console.log(`DRY: would upload ${photo.buffer.length} bytes`); updated++; await sleep(300); continue; }

            const s3Url = await uploadToS3(venue.id, photo.buffer, photo.contentType);
            await db.update(venues).set({ coverImageUrl: s3Url, updatedAt: new Date() }).where(eq(venues.id, venue.id));
            console.log(`✓ ${s3Url.split('/').pop()}`);
            updated++;
        } catch (err) {
            console.log(`error: ${(err as Error).message?.slice(0, 80)}`);
            errors++;
        }
        await sleep(300);
    }

    console.log(`\nDone. Updated: ${updated}, No results: ${noResults}, Errors: ${errors}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
