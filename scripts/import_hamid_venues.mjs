#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';

const REPO_ROOT = path.resolve('d:/MatchWatch.us/JazzB-watchparty');
const OUTPUT_DIR = path.join(REPO_ROOT, 'output');
const DEFAULT_REF = process.env.HAMID_REF || 'origin/hamid';
const BASE_URL = (process.env.MATCHWATCH_BASE_URL || 'https://matchwatch.us').replace(/\/+$/, '');
const DEFAULT_OWNER_PASSWORD = process.env.DEFAULT_OWNER_PASSWORD?.trim() || null;
const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');

function runGitShow(ref, filePath) {
  return execFileSync('git', ['-C', REPO_ROOT, 'show', `${ref}:${filePath}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function extractExportArray(source, exportName) {
  const marker = `export const ${exportName}`;
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`Could not find export ${exportName}`);
  }

  const equalsIndex = source.indexOf('=', start);
  if (equalsIndex < 0) {
    throw new Error(`Could not find assignment for ${exportName}`);
  }

  const arrayStart = source.indexOf('[', equalsIndex);
  if (arrayStart < 0) {
    throw new Error(`Could not find array start for ${exportName}`);
  }

  let depth = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = arrayStart; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    const prev = source[i - 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      if (prev === '*' && char === '/') blockComment = false;
      continue;
    }

    if (quote) {
      if (char === quote && prev !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      lineComment = true;
      continue;
    }

    if (char === '/' && next === '*') {
      blockComment = true;
      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(arrayStart, i + 1);
      }
    }
  }

  throw new Error(`Could not extract ${exportName} array`);
}

function loadHamidVenues(ref) {
  const source = runGitShow(ref, 'HtownKickoff-main/src/lib/data.ts');
  const arrayLiteral = extractExportArray(source, 'VENUES');
  const venues = vm.runInNewContext(`(${arrayLiteral})`, {});
  if (!Array.isArray(venues)) {
    throw new Error('VENUES export did not evaluate to an array');
  }
  return venues;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

function normalizeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function normalizeInstagram(value) {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  return raw.startsWith('@') ? raw : `@${raw}`;
}

function normalizeVenue(rawVenue) {
  const ownerEmail = String(rawVenue.ownerEmail || '').trim().toLowerCase();
  const ownerName = String(rawVenue.ownerName || ownerEmail.split('@')[0] || rawVenue.name || 'Business Owner').trim();

  return {
    sourceId: String(rawVenue.id || ''),
    ownerEmail,
    ownerName,
    name: String(rawVenue.name || '').trim(),
    slug: slugify(rawVenue.slug || rawVenue.name),
    description: String(rawVenue.description || '').trim() || undefined,
    shortDescription: String(rawVenue.shortDescription || '').trim() || undefined,
    addressLine1: String(rawVenue.addressLine1 || '').trim(),
    addressLine2: String(rawVenue.addressLine2 || '').trim() || undefined,
    city: String(rawVenue.city || '').trim(),
    stateProvince: String(rawVenue.state || rawVenue.stateProvince || '').trim() || undefined,
    country: String(rawVenue.country || 'US').trim(),
    postalCode: String(rawVenue.postalCode || '').trim() || undefined,
    lat: Number(rawVenue.lat),
    lng: Number(rawVenue.lng),
    timezone: String(rawVenue.timezone || 'America/Chicago').trim(),
    phone: String(rawVenue.phone || '').trim() || undefined,
    website: normalizeUrl(rawVenue.website),
    instagramHandle: normalizeInstagram(rawVenue.instagram),
    googleMapsUrl: normalizeUrl(rawVenue.googleMapsUrl),
    capacity: Number.isFinite(Number(rawVenue.capacity)) ? Number(rawVenue.capacity) : undefined,
    amenities: Array.isArray(rawVenue.amenities) ? rawVenue.amenities.map((v) => String(v)) : [],
    vibes: Array.isArray(rawVenue.vibes) ? rawVenue.vibes.map((v) => String(v)) : [],
    cuisineTags: Array.isArray(rawVenue.cuisineTags) ? rawVenue.cuisineTags.map((v) => String(v)) : [],
    priceRange: ['BUDGET', 'MID', 'UPSCALE', 'LUXURY'].includes(String(rawVenue.priceRange))
      ? String(rawVenue.priceRange)
      : 'MID',
    isVerified: Boolean(rawVenue.isVerified),
    isActive: Boolean(rawVenue.isActive ?? true),
    isFeatured: Boolean(rawVenue.isFeatured),
  };
}

function buildPassword() {
  if (DEFAULT_OWNER_PASSWORD) return DEFAULT_OWNER_PASSWORD;
  return `Venue!${crypto.randomBytes(6).toString('base64url')}9A`;
}

async function apiFetch(pathname, options = {}, cookie = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${BASE_URL}${pathname}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const message = payload?.error?.message || `Request failed: ${response.status}`;
    const details = payload?.error?.details ? ` ${JSON.stringify(payload.error.details)}` : '';
    throw new Error(`${pathname} -> ${message}${details}`);
  }
  return { payload, response };
}

async function loginSuperAdmin() {
  const username = process.env.SUPER_ADMIN_USERNAME?.trim();
  const password = process.env.SUPER_ADMIN_PASSWORD?.trim();

  if (!username || !password) {
    throw new Error('SUPER_ADMIN_USERNAME and SUPER_ADMIN_PASSWORD are required for --apply');
  }

  const response = await fetch(`${BASE_URL}/api/v1/super-admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message || `Login failed: ${response.status}`);
  }

  const setCookie = response.headers.getSetCookie?.() || [];
  const sessionCookie = setCookie
    .map((entry) => entry.split(';')[0])
    .find((entry) => entry.startsWith('mw_super_admin='));

  if (!sessionCookie) {
    throw new Error('Super admin session cookie was not returned');
  }

  return sessionCookie;
}

async function fetchPaged(pathname, cookie) {
  const rows = [];
  let page = 1;

  while (true) {
    const { payload } = await apiFetch(`${pathname}${pathname.includes('?') ? '&' : '?'}page=${page}&limit=200`, {}, cookie);
    const data = Array.isArray(payload.data) ? payload.data : [];
    rows.push(...data);
    const meta = payload.meta;
    if (!meta || page >= Number(meta.totalPages || 1)) break;
    page += 1;
  }

  return rows;
}

async function main() {
  const rawVenues = loadHamidVenues(DEFAULT_REF);
  const venues = rawVenues.map(normalizeVenue).filter((venue) => venue.name && venue.addressLine1 && venue.city && venue.ownerEmail);

  const ownerEmails = [...new Set(venues.map((venue) => venue.ownerEmail))];

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const reportPath = path.join(OUTPUT_DIR, 'hamid-venue-import-report.json');

  if (!APPLY) {
    const report = {
      mode: 'dry-run',
      ref: DEFAULT_REF,
      venueCount: venues.length,
      uniqueOwnerCount: ownerEmails.length,
      sampleVenues: venues.slice(0, 5),
    };
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.log(`\nDry-run report written to ${reportPath}`);
    console.log('\nRun with --apply and env SUPER_ADMIN_USERNAME/SUPER_ADMIN_PASSWORD to import.');
    return;
  }

  const cookie = await loginSuperAdmin();
  const [existingUsers, existingVenues] = await Promise.all([
    fetchPaged('/api/v1/super-admin/users', cookie),
    fetchPaged('/api/v1/super-admin/venues', cookie),
  ]);

  const usersByEmail = new Map(existingUsers.map((user) => [String(user.email || '').toLowerCase(), user]));
  const existingVenueKeys = new Set(
    existingVenues.flatMap((venue) => {
      const keys = [];
      if (venue.slug) keys.push(`slug:${String(venue.slug).toLowerCase()}`);
      if (venue.name && venue.addressLine1) keys.push(`nameaddr:${String(venue.name).toLowerCase()}|${String(venue.addressLine1).toLowerCase()}`);
      return keys;
    }),
  );

  const report = {
    mode: 'apply',
    ref: DEFAULT_REF,
    venueCount: venues.length,
    uniqueOwnerCount: ownerEmails.length,
    createdUsers: [],
    reusedUsers: [],
    createdVenues: [],
    skippedVenues: [],
    ownerPasswords: {},
  };

  for (const email of ownerEmails) {
    const existingUser = usersByEmail.get(email);
    if (existingUser) {
      report.reusedUsers.push({ email, id: existingUser.id, role: existingUser.role });
      continue;
    }

    const sampleVenue = venues.find((venue) => venue.ownerEmail === email);
    const password = buildPassword();
    const body = {
      email,
      name: sampleVenue?.ownerName || email.split('@')[0],
      password,
      role: 'BUSINESS',
    };

    const { payload } = await apiFetch('/api/v1/super-admin/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }, cookie);

    usersByEmail.set(email, payload.data);
    report.createdUsers.push({ email, id: payload.data.id, role: payload.data.role });
    report.ownerPasswords[email] = password;
  }

  for (const venue of venues) {
    const duplicateKeyA = `slug:${venue.slug.toLowerCase()}`;
    const duplicateKeyB = `nameaddr:${venue.name.toLowerCase()}|${venue.addressLine1.toLowerCase()}`;
    if (!FORCE && (existingVenueKeys.has(duplicateKeyA) || existingVenueKeys.has(duplicateKeyB))) {
      report.skippedVenues.push({ name: venue.name, slug: venue.slug, reason: 'duplicate' });
      continue;
    }

    const owner = usersByEmail.get(venue.ownerEmail);
    if (!owner) {
      report.skippedVenues.push({ name: venue.name, slug: venue.slug, reason: `missing owner ${venue.ownerEmail}` });
      continue;
    }

    const body = {
      ownerId: owner.id,
      name: venue.name,
      slug: venue.slug,
      description: venue.description,
      shortDescription: venue.shortDescription,
      addressLine1: venue.addressLine1,
      addressLine2: venue.addressLine2,
      city: venue.city,
      stateProvince: venue.stateProvince,
      country: venue.country,
      postalCode: venue.postalCode,
      lat: venue.lat,
      lng: venue.lng,
      timezone: venue.timezone,
      phone: venue.phone,
      website: venue.website,
      instagramHandle: venue.instagramHandle,
      googleMapsUrl: venue.googleMapsUrl,
      amenities: venue.amenities,
      vibes: venue.vibes,
      cuisineTags: venue.cuisineTags,
      priceRange: venue.priceRange,
      capacity: venue.capacity,
      isVerified: venue.isVerified,
      isActive: venue.isActive,
      isFeatured: venue.isFeatured,
    };

    const { payload } = await apiFetch('/api/v1/super-admin/venues', {
      method: 'POST',
      body: JSON.stringify(body),
    }, cookie);

    report.createdVenues.push({
      name: payload.data.name,
      slug: payload.data.slug,
      id: payload.data.id,
      ownerEmail: venue.ownerEmail,
    });

    existingVenueKeys.add(duplicateKeyA);
    existingVenueKeys.add(duplicateKeyB);
  }

  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    createdUsers: report.createdUsers.length,
    reusedUsers: report.reusedUsers.length,
    createdVenues: report.createdVenues.length,
    skippedVenues: report.skippedVenues.length,
    reportPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
