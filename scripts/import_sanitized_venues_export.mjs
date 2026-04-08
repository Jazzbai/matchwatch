#!/usr/bin/env node

import crypto from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'output');
const DEFAULT_INPUT_PATH = path.join(OUTPUT_DIR, 'venues-export.sanitized.json');
const DEFAULT_REVIEW_REPORT_PATH = path.join(OUTPUT_DIR, 'venues-export.review.json');
const BASE_URL = (process.env.MATCHWATCH_BASE_URL || 'https://matchwatch.us').replace(/\/+$/, '');
const DEFAULT_OWNER_PASSWORD = process.env.DEFAULT_OWNER_PASSWORD?.trim() || null;

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    inputPath: DEFAULT_INPUT_PATH,
    reviewReportPath: DEFAULT_REVIEW_REPORT_PATH,
    apply: false,
    force: false,
    excludeHighRisk: false,
    excludeWeakAddresses: false,
    excludeMissingSportsEvidence: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (arg === '--exclude-high-risk') {
      options.excludeHighRisk = true;
      continue;
    }
    if (arg === '--exclude-weak-addresses') {
      options.excludeWeakAddresses = true;
      continue;
    }
    if (arg === '--exclude-missing-sports-evidence') {
      options.excludeMissingSportsEvidence = true;
      continue;
    }
    if (arg === '--review-report') {
      options.reviewReportPath = path.resolve(args[i + 1]);
      i += 1;
      continue;
    }
    if (!arg.startsWith('--')) {
      options.inputPath = path.resolve(arg);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function buildPassword() {
  if (DEFAULT_OWNER_PASSWORD) return DEFAULT_OWNER_PASSWORD;
  return `Venue!${crypto.randomBytes(6).toString('base64url')}9A`;
}

function normalizeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function normalizeVenue(rawVenue) {
  const ownerEmail = String(rawVenue?.owner?.email || '').trim().toLowerCase();
  const ownerName = String(rawVenue?.owner?.name || ownerEmail.split('@')[0] || rawVenue?.name || 'Business Owner').trim();
  const rawCapacity = rawVenue?.capacity;

  return {
    sourceId: String(rawVenue?.id || ''),
    ownerEmail,
    ownerName,
    name: String(rawVenue?.name || '').trim(),
    slug: String(rawVenue?.slug || '').trim(),
    description: String(rawVenue?.description || '').trim() || undefined,
    shortDescription: String(rawVenue?.shortDescription || '').trim() || undefined,
    addressLine1: String(rawVenue?.address?.line1 || '').trim(),
    addressLine2: String(rawVenue?.address?.line2 || '').trim() || undefined,
    city: String(rawVenue?.address?.city || '').trim(),
    stateProvince: String(rawVenue?.address?.state || '').trim() || undefined,
    country: String(rawVenue?.address?.country || 'US').trim(),
    postalCode: String(rawVenue?.address?.postalCode || '').trim() || undefined,
    lat: Number(rawVenue?.address?.lat),
    lng: Number(rawVenue?.address?.lng),
    timezone: String(rawVenue?.address?.timezone || 'America/Chicago').trim(),
    phone: String(rawVenue?.phone || '').trim() || undefined,
    website: normalizeUrl(rawVenue?.website),
    capacity: rawCapacity === null || rawCapacity === undefined || rawCapacity === ''
      ? undefined
      : (Number.isFinite(Number(rawCapacity)) ? Number(rawCapacity) : undefined),
    amenities: Array.isArray(rawVenue?.amenities) ? rawVenue.amenities.map((value) => String(value)) : [],
    vibes: Array.isArray(rawVenue?.vibes) ? rawVenue.vibes.map((value) => String(value)) : [],
    cuisineTags: Array.isArray(rawVenue?.cuisineTags) ? rawVenue.cuisineTags.map((value) => String(value)) : [],
    priceRange: ['BUDGET', 'MID', 'UPSCALE', 'LUXURY'].includes(String(rawVenue?.priceRange))
      ? String(rawVenue.priceRange)
      : 'MID',
    isVerified: Boolean(rawVenue?.isVerified),
    isActive: Boolean(rawVenue?.isActive ?? true),
    isFeatured: Boolean(rawVenue?.isFeatured),
  };
}

function normalizeInput(rawVenues) {
  if (!Array.isArray(rawVenues)) {
    throw new Error('Sanitized export must be a JSON array.');
  }

  return rawVenues
    .map(normalizeVenue)
    .filter((venue) => venue.name && venue.slug && venue.addressLine1 && venue.city && venue.ownerEmail);
}

function loadExclusionSets(reviewReportPath, options) {
  const needsReport = options.excludeHighRisk || options.excludeWeakAddresses || options.excludeMissingSportsEvidence;
  const excludedIds = new Map();
  if (!needsReport) {
    return excludedIds;
  }

  const reviewReport = readJson(reviewReportPath);

  if (options.excludeHighRisk) {
    for (const item of reviewReport.highRiskVenueTypes || []) {
      excludedIds.set(String(item.id), 'high-risk-venue-type');
    }
  }

  if (options.excludeWeakAddresses) {
    for (const item of reviewReport.weakAddressLines || []) {
      excludedIds.set(String(item.id), 'weak-address-line');
    }
  }

  if (options.excludeMissingSportsEvidence) {
    for (const item of reviewReport.sportsEvidenceMissing || []) {
      excludedIds.set(String(item.id), 'missing-sports-evidence');
    }
  }

  return excludedIds;
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
  const options = parseArgs(process.argv);
  const rawVenues = readJson(options.inputPath);
  const venues = normalizeInput(rawVenues);
  const excludedIds = loadExclusionSets(options.reviewReportPath, options);

  const includedVenues = [];
  const excludedVenues = [];

  for (const venue of venues) {
    const exclusionReason = excludedIds.get(venue.sourceId);
    if (exclusionReason) {
      excludedVenues.push({
        sourceId: venue.sourceId,
        name: venue.name,
        slug: venue.slug,
        reason: exclusionReason,
      });
      continue;
    }
    includedVenues.push(venue);
  }

  const ownerEmails = [...new Set(includedVenues.map((venue) => venue.ownerEmail))];

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const reportPath = path.join(OUTPUT_DIR, 'sanitized-venue-import-report.json');

  if (!options.apply) {
    const report = {
      mode: 'dry-run',
      inputPath: options.inputPath,
      reviewReportPath: options.reviewReportPath,
      venueCount: venues.length,
      includedVenueCount: includedVenues.length,
      excludedVenueCount: excludedVenues.length,
      uniqueOwnerCount: ownerEmails.length,
      excludeHighRisk: options.excludeHighRisk,
      excludeWeakAddresses: options.excludeWeakAddresses,
      excludeMissingSportsEvidence: options.excludeMissingSportsEvidence,
      excludedVenues,
      sampleVenues: includedVenues.slice(0, 5),
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
    inputPath: options.inputPath,
    reviewReportPath: options.reviewReportPath,
    venueCount: venues.length,
    includedVenueCount: includedVenues.length,
    excludedVenueCount: excludedVenues.length,
    uniqueOwnerCount: ownerEmails.length,
    excludeHighRisk: options.excludeHighRisk,
    excludeWeakAddresses: options.excludeWeakAddresses,
    excludeMissingSportsEvidence: options.excludeMissingSportsEvidence,
    excludedVenues,
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

    const sampleVenue = includedVenues.find((venue) => venue.ownerEmail === email);
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

  for (const venue of includedVenues) {
    const duplicateKeyA = `slug:${venue.slug.toLowerCase()}`;
    const duplicateKeyB = `nameaddr:${venue.name.toLowerCase()}|${venue.addressLine1.toLowerCase()}`;
    if (!options.force && (existingVenueKeys.has(duplicateKeyA) || existingVenueKeys.has(duplicateKeyB))) {
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
    excludedVenues: report.excludedVenues.length,
    reportPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
