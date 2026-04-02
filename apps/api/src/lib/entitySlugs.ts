import { and, eq, ne } from 'drizzle-orm';
import { db } from '../db/client';
import { drivers, entrants, entitySlugRedirects, leagues, manufacturers, players, sports, stadiums, teams } from '../db/schema';
import { logger } from './logger';
import { slugify } from './utils';

export type CanonicalEntityKind = 'league' | 'team' | 'player' | 'driver' | 'entrant' | 'manufacturer' | 'stadium';

type EntityRow = {
    id: string;
    name: string;
    slug: string;
    shortName?: string | null;
};

type ResolveResult = {
    entityId: string;
    canonicalSlug: string;
    matchedVia: 'id' | 'slug' | 'redirect';
    redirectSlug?: string;
};

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeBaseSlug(value: string, fallback: string) {
    const slug = slugify(value);
    return slug || fallback;
}

function buildSlugCandidates(name: string, shortName?: string | null) {
    const base = normalizeBaseSlug(name, 'entity');
    const candidates = new Set<string>([base]);
    const normalizedShort = normalizeBaseSlug(shortName || '', '');
    if (normalizedShort && normalizedShort !== base) {
        candidates.add(`${base}-${normalizedShort}`);
    }
    return Array.from(candidates);
}

async function currentSlugExists(kind: CanonicalEntityKind, slug: string, excludeId?: string) {
    if (kind === 'league') {
        const [row] = await db.select({ id: leagues.id }).from(leagues).where(excludeId ? and(eq(leagues.slug, slug), ne(leagues.id, excludeId)) : eq(leagues.slug, slug)).limit(1);
        return Boolean(row);
    }
    if (kind === 'team') {
        const [row] = await db.select({ id: teams.id }).from(teams).where(excludeId ? and(eq(teams.slug, slug), ne(teams.id, excludeId)) : eq(teams.slug, slug)).limit(1);
        return Boolean(row);
    }
    if (kind === 'player') {
        const [row] = await db.select({ id: players.id }).from(players).where(excludeId ? and(eq(players.slug, slug), ne(players.id, excludeId)) : eq(players.slug, slug)).limit(1);
        return Boolean(row);
    }
    if (kind === 'driver') {
        const [row] = await db.select({ id: drivers.id }).from(drivers).where(excludeId ? and(eq(drivers.slug, slug), ne(drivers.id, excludeId)) : eq(drivers.slug, slug)).limit(1);
        return Boolean(row);
    }
    if (kind === 'entrant') {
        const [row] = await db.select({ id: entrants.id }).from(entrants).where(excludeId ? and(eq(entrants.slug, slug), ne(entrants.id, excludeId)) : eq(entrants.slug, slug)).limit(1);
        return Boolean(row);
    }
    if (kind === 'stadium') {
        const [row] = await db.select({ id: stadiums.id }).from(stadiums).where(excludeId ? and(eq(stadiums.slug, slug), ne(stadiums.id, excludeId)) : eq(stadiums.slug, slug)).limit(1);
        return Boolean(row);
    }
    const [row] = await db.select({ id: manufacturers.id }).from(manufacturers).where(excludeId ? and(eq(manufacturers.slug, slug), ne(manufacturers.id, excludeId)) : eq(manufacturers.slug, slug)).limit(1);
    return Boolean(row);
}

async function redirectSlugExists(kind: CanonicalEntityKind, slug: string, excludeId?: string) {
    const [row] = await db.select({ id: entitySlugRedirects.id }).from(entitySlugRedirects).where(
        excludeId
            ? and(eq(entitySlugRedirects.entityType, kind), eq(entitySlugRedirects.slug, slug), ne(entitySlugRedirects.entityId, excludeId))
            : and(eq(entitySlugRedirects.entityType, kind), eq(entitySlugRedirects.slug, slug)),
    ).limit(1);
    return Boolean(row);
}

async function anySlugExists(kind: CanonicalEntityKind, slug: string, excludeId?: string) {
    const [currentExists, redirectExists] = await Promise.all([
        currentSlugExists(kind, slug, excludeId),
        redirectSlugExists(kind, slug, excludeId),
    ]);
    return currentExists || redirectExists;
}

export async function allocateCanonicalSlug(kind: CanonicalEntityKind, name: string, options?: { shortName?: string | null; excludeId?: string }) {
    const candidates = buildSlugCandidates(name, options?.shortName);
    for (const candidate of candidates) {
        if (!(await anySlugExists(kind, candidate, options?.excludeId))) {
            return candidate;
        }
    }

    const base = candidates[0] || 'entity';
    let index = 2;
    while (index < 1000) {
        const candidate = `${base}-${index}`;
        if (!(await anySlugExists(kind, candidate, options?.excludeId))) {
            return candidate;
        }
        index += 1;
    }

    throw new Error(`Unable to allocate canonical slug for ${kind}`);
}

export async function recordSlugRedirect(kind: CanonicalEntityKind, entityId: string, slug: string) {
    const normalizedSlug = normalizeBaseSlug(slug, 'entity');
    if (!normalizedSlug) return;
    await db.insert(entitySlugRedirects).values({
        entityType: kind,
        entityId,
        slug: normalizedSlug,
        updatedAt: new Date(),
    }).onConflictDoNothing();
}

async function updateEntitySlug(kind: CanonicalEntityKind, entityId: string, slug: string) {
    const updatedAt = new Date();
    if (kind === 'league') {
        await db.update(leagues).set({ slug, updatedAt }).where(eq(leagues.id, entityId));
        return;
    }
    if (kind === 'team') {
        await db.update(teams).set({ slug }).where(eq(teams.id, entityId));
        return;
    }
    if (kind === 'player') {
        await db.update(players).set({ slug, updatedAt }).where(eq(players.id, entityId));
        return;
    }
    if (kind === 'driver') {
        await db.update(drivers).set({ slug, updatedAt }).where(eq(drivers.id, entityId));
        return;
    }
    if (kind === 'entrant') {
        await db.update(entrants).set({ slug, updatedAt }).where(eq(entrants.id, entityId));
        return;
    }
    if (kind === 'stadium') {
        await db.update(stadiums).set({ slug, updatedAt }).where(eq(stadiums.id, entityId));
        return;
    }
    await db.update(manufacturers).set({ slug, updatedAt }).where(eq(manufacturers.id, entityId));
}

export async function syncCanonicalSlug(kind: CanonicalEntityKind, row: EntityRow) {
    const canonicalSlug = await allocateCanonicalSlug(kind, row.name, { shortName: row.shortName, excludeId: row.id });
    if (row.slug === canonicalSlug) {
        return { slug: row.slug, changed: false };
    }
    await recordSlugRedirect(kind, row.id, row.slug);
    await updateEntitySlug(kind, row.id, canonicalSlug);
    logger.info({ entityKind: kind, entityId: row.id, previousSlug: row.slug, canonicalSlug }, 'Normalized entity slug');
    return { slug: canonicalSlug, changed: true };
}

export async function resolveCanonicalEntity(kind: CanonicalEntityKind, slugOrId: string): Promise<ResolveResult | null> {
    const lookupByCurrent = async () => {
        if (kind === 'league') {
            const [row] = await db.select({ id: leagues.id, slug: leagues.slug }).from(leagues).where(isUuid(slugOrId) ? eq(leagues.id, slugOrId) : eq(leagues.slug, slugOrId)).limit(1);
            return row ? { entityId: row.id, canonicalSlug: row.slug, matchedVia: isUuid(slugOrId) ? 'id' as const : 'slug' as const } : null;
        }
        if (kind === 'team') {
            const [row] = await db.select({ id: teams.id, slug: teams.slug }).from(teams).where(isUuid(slugOrId) ? eq(teams.id, slugOrId) : eq(teams.slug, slugOrId)).limit(1);
            return row ? { entityId: row.id, canonicalSlug: row.slug, matchedVia: isUuid(slugOrId) ? 'id' as const : 'slug' as const } : null;
        }
        if (kind === 'player') {
            const [row] = await db.select({ id: players.id, slug: players.slug }).from(players).where(isUuid(slugOrId) ? eq(players.id, slugOrId) : eq(players.slug, slugOrId)).limit(1);
            return row ? { entityId: row.id, canonicalSlug: row.slug, matchedVia: isUuid(slugOrId) ? 'id' as const : 'slug' as const } : null;
        }
        if (kind === 'driver') {
            const [row] = await db.select({ id: drivers.id, slug: drivers.slug }).from(drivers).where(isUuid(slugOrId) ? eq(drivers.id, slugOrId) : eq(drivers.slug, slugOrId)).limit(1);
            return row ? { entityId: row.id, canonicalSlug: row.slug, matchedVia: isUuid(slugOrId) ? 'id' as const : 'slug' as const } : null;
        }
        if (kind === 'entrant') {
            const [row] = await db.select({ id: entrants.id, slug: entrants.slug }).from(entrants).where(isUuid(slugOrId) ? eq(entrants.id, slugOrId) : eq(entrants.slug, slugOrId)).limit(1);
            return row ? { entityId: row.id, canonicalSlug: row.slug, matchedVia: isUuid(slugOrId) ? 'id' as const : 'slug' as const } : null;
        }
        if (kind === 'stadium') {
            const [row] = await db.select({ id: stadiums.id, slug: stadiums.slug }).from(stadiums).where(isUuid(slugOrId) ? eq(stadiums.id, slugOrId) : eq(stadiums.slug, slugOrId)).limit(1);
            return row ? { entityId: row.id, canonicalSlug: row.slug, matchedVia: isUuid(slugOrId) ? 'id' as const : 'slug' as const } : null;
        }
        const [row] = await db.select({ id: manufacturers.id, slug: manufacturers.slug }).from(manufacturers).where(isUuid(slugOrId) ? eq(manufacturers.id, slugOrId) : eq(manufacturers.slug, slugOrId)).limit(1);
        return row ? { entityId: row.id, canonicalSlug: row.slug, matchedVia: isUuid(slugOrId) ? 'id' as const : 'slug' as const } : null;
    };

    const current = await lookupByCurrent();
    if (current) return current;
    if (isUuid(slugOrId)) return null;

    const [redirect] = await db.select({ entityId: entitySlugRedirects.entityId, redirectSlug: entitySlugRedirects.slug }).from(entitySlugRedirects).where(and(eq(entitySlugRedirects.entityType, kind), eq(entitySlugRedirects.slug, slugOrId))).limit(1);
    if (!redirect) return null;

    const canonical = await resolveCanonicalEntity(kind, redirect.entityId);
    if (!canonical) return null;
    return {
        entityId: canonical.entityId,
        canonicalSlug: canonical.canonicalSlug,
        matchedVia: 'redirect',
        redirectSlug: redirect.redirectSlug,
    };
}

async function fetchRows(kind: CanonicalEntityKind): Promise<EntityRow[]> {
    if (kind === 'league') return db.select({ id: leagues.id, name: leagues.name, slug: leagues.slug, shortName: leagues.shortName }).from(leagues).orderBy(leagues.createdAt);
    if (kind === 'team') return db.select({ id: teams.id, name: teams.name, slug: teams.slug, shortName: teams.shortName }).from(teams).orderBy(teams.createdAt);
    if (kind === 'player') return db.select({ id: players.id, name: players.name, slug: players.slug, shortName: players.shortName }).from(players).orderBy(players.createdAt);
    if (kind === 'driver') return db.select({ id: drivers.id, name: drivers.name, slug: drivers.slug, shortName: drivers.shortName }).from(drivers).orderBy(drivers.createdAt);
    if (kind === 'entrant') return db.select({ id: entrants.id, name: entrants.name, slug: entrants.slug, shortName: entrants.shortName }).from(entrants).orderBy(entrants.createdAt);
    if (kind === 'stadium') return db.select({ id: stadiums.id, name: stadiums.name, slug: stadiums.slug, shortName: stadiums.shortName }).from(stadiums).orderBy(stadiums.createdAt);
    return db.select({ id: manufacturers.id, name: manufacturers.name, slug: manufacturers.slug, shortName: manufacturers.shortName }).from(manufacturers).orderBy(manufacturers.createdAt);
}

export async function normalizeEntitySlugs() {
    const kinds: CanonicalEntityKind[] = ['league', 'team', 'player', 'driver', 'entrant', 'manufacturer', 'stadium'];
    for (const kind of kinds) {
        const rows = await fetchRows(kind);
        for (const row of rows) {
            try {
                await syncCanonicalSlug(kind, row);
            } catch (error) {
                logger.error({ entityKind: kind, entityId: row.id, slug: row.slug, err: error }, 'Failed normalizing entity slug');
            }
        }
    }
}

export async function findSportSlugForLeague(leagueId: string) {
    const [row] = await db.select({ sportSlug: sports.slug }).from(leagues).innerJoin(sports, eq(leagues.sportId, sports.id)).where(eq(leagues.id, leagueId)).limit(1);
    return row?.sportSlug || null;
}
