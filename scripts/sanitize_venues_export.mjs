#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, 'output');

const VALID_AMENITIES = [
  'TV',
  'PROJECTOR',
  'HOOKAH',
  'VIP',
  'SMOKE_FREE',
  'ALCOHOLIC',
  'OUTDOOR',
  'WIFI',
  'PARKING',
  'FOOD',
  'KIDS',
  'LIVE_MUSIC',
  'PRIVATE_ROOM',
];

const VALID_VIBES = [
  'CASUAL',
  'LIVELY',
  'FAMILY_FRIENDLY',
  'LUXURY',
  'NEIGHBORHOOD',
  'GAME_DAY',
  'LATE_NIGHT',
  'UPSCALE',
];

const VALID_CUISINES = [
  'ITALIAN',
  'MEXICAN',
  'CHINESE',
  'JAPANESE',
  'TURKISH',
  'AMERICAN',
  'MIDDLE_EASTERN',
  'INDIAN',
  'THAI',
  'KOREAN',
  'MEDITERRANEAN',
  'BRAZILIAN',
  'FRENCH',
  'SEAFOOD',
  'BBQ',
  'VEGAN',
  'FAST_FOOD',
];

const VALID_PRICE_RANGES = new Set(['BUDGET', 'MID', 'UPSCALE', 'LUXURY']);
const ORDER_INDEX = new Map(
  [...VALID_AMENITIES, ...VALID_VIBES, ...VALID_CUISINES].map((value, index) => [value, index]),
);

const MANUAL_CORRECTIONS = {
  'de216b1d-c79e-4320-b3e9-7239bcb25178': {
    address: {
      city: 'Birmingham',
      state: 'AL',
      timezone: 'America/Chicago',
    },
  },
};

const REVIEW_HINTS = {
  '9a1024c6-fc66-4edd-afd9-7894a3355a5e': {
    suggestedCity: 'Miami Beach',
    suggestedState: 'FL',
    reason: 'Name explicitly says Miami Beach while address city is stored as Miami.',
  },
  '7b974c9a-7f60-42dc-b20f-3699432852ef': {
    suggestedCity: 'Olathe',
    suggestedState: 'KS',
    reason: 'Name explicitly says Olathe while address city is stored as Kansas City.',
  },
};

const SPORTS_EVIDENCE_PATTERN = /(soccer|sportsbar|sports bar|sports-centric|sports-viewing|watch party|watch bar|watchbar|watching|televised|tvs?\b|big screens?|tons of tvs|lots of tvs|sports on|pitch\s*\d+|ale house|sporting club|sporting kc|bullpen)/;

function parseArgs(argv) {
  const args = argv.slice(2);
  let inputPath = null;
  let outputDir = DEFAULT_OUTPUT_DIR;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--out-dir') {
      outputDir = path.resolve(args[i + 1]);
      i += 1;
      continue;
    }
    if (!inputPath) {
      inputPath = path.resolve(arg);
    }
  }

  if (!inputPath) {
    throw new Error('Usage: node scripts/sanitize_venues_export.mjs <input-json-path> [--out-dir <dir>]');
  }

  return { inputPath, outputDir };
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function toSlugPart(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function sortByKnownOrder(values) {
  return [...new Set(values)].sort((a, b) => {
    const aIndex = ORDER_INDEX.has(a) ? ORDER_INDEX.get(a) : Number.MAX_SAFE_INTEGER;
    const bIndex = ORDER_INDEX.has(b) ? ORDER_INDEX.get(b) : Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.localeCompare(b);
  });
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function fillMissingDescriptions(record) {
  const description = cleanText(record.description);
  const shortDescription = cleanText(record.shortDescription);

  if (!description && shortDescription) {
    record.description = shortDescription;
  }

  if (!shortDescription && description) {
    record.shortDescription = description.slice(0, 280);
  }
}

function stripGoogleApiKey(rawUrl) {
  if (!rawUrl) return { value: rawUrl, changed: false };

  try {
    const parsed = new URL(rawUrl);
    const hasGoogleHost = /(^|\.)googleapis\.com$/i.test(parsed.hostname);
    if (!hasGoogleHost) {
      return { value: rawUrl, changed: false };
    }

    const changed = parsed.searchParams.has('key');
    if (changed) {
      parsed.searchParams.delete('key');
    }

    return {
      value: parsed.toString(),
      changed,
    };
  } catch {
    return { value: rawUrl, changed: false };
  }
}

function inferText(record) {
  return [
    record.name,
    record.description,
    record.shortDescription,
    record.website,
    ...(record.googleTypes || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function inferAmenities(record, text) {
  const types = new Set(record.googleTypes || []);
  const amenities = [];

  const hasSportsEvidence = SPORTS_EVIDENCE_PATTERN.test(text);
  const hasBarEvidence = /(bar|pub|beer|cocktail|ale house|lounge|nightclub|rooftop)/.test(text) || types.has('bar') || types.has('night_club');
  const hasFoodEvidence = /(restaurant|food|fare|grub|kitchen|menu|cafe|dishes|staples|sandwich|wings|burgers|steaks|pizza|seafood|breakfast|tapas|small plates|comfort food)/.test(text)
    || types.has('restaurant')
    || types.has('food')
    || types.has('cafe')
    || types.has('meal_takeaway');

  if (hasSportsEvidence) {
    amenities.push('TV');
  }

  if (/\bprojector\b/.test(text)) {
    amenities.push('PROJECTOR');
  }

  if (hasBarEvidence) {
    amenities.push('ALCOHOLIC');
  }

  if (hasFoodEvidence) {
    amenities.push('FOOD');
  }

  if (/(outdoor|patio|rooftop|beer garden|garden|outdoor seats|city views)/.test(text)) {
    amenities.push('OUTDOOR');
  }

  if (/(kid-friendly|kids|family-friendly)/.test(text)) {
    amenities.push('KIDS');
  }

  if (/(live music)/.test(text)) {
    amenities.push('LIVE_MUSIC');
  }

  return sortByKnownOrder(amenities.filter((value) => VALID_AMENITIES.includes(value)));
}

function inferVibes(record, text) {
  const types = new Set(record.googleTypes || []);
  const vibes = [];

  if (/(casual|chill|easygoing|no-frills|relaxed)/.test(text)) {
    vibes.push('CASUAL');
  }

  if (/(lively|vibrant|energetic|beer garden|nightclub|dj|live music|watch party|sports-viewing)/.test(text) || types.has('night_club')) {
    vibes.push('LIVELY');
  }

  if (/(family-friendly|kid-friendly|kids)/.test(text)) {
    vibes.push('FAMILY_FRIENDLY');
  }

  if (record.priceRange === 'LUXURY' || /(luxury|revered|fine dining)/.test(text)) {
    vibes.push('LUXURY');
  }

  if (/(neighborhood)/.test(text)) {
    vibes.push('NEIGHBORHOOD');
  }

  if (SPORTS_EVIDENCE_PATTERN.test(text)) {
    vibes.push('GAME_DAY');
  }

  if (types.has('night_club') || /(late night|nightclub|lounge|dj)/.test(text)) {
    vibes.push('LATE_NIGHT');
  }

  if (record.priceRange === 'UPSCALE' || /(stylish|upscale|elevated|premium|midcentury)/.test(text)) {
    vibes.push('UPSCALE');
  }

  return sortByKnownOrder(vibes.filter((value) => VALID_VIBES.includes(value)));
}

function inferCuisineTags(text) {
  const cuisines = [];

  if (/(american|new american|pub grub|burgers|wings|comfort food|ale house|gastropub|sports-pub)/.test(text)) {
    cuisines.push('AMERICAN');
  }

  if (/(middle eastern|lebanese)/.test(text)) {
    cuisines.push('MIDDLE_EASTERN');
  }

  if (/(mediterranean|lebanese)/.test(text)) {
    cuisines.push('MEDITERRANEAN');
  }

  if (/\bindian\b/.test(text)) {
    cuisines.push('INDIAN');
  }

  if (/\bthai\b/.test(text)) {
    cuisines.push('THAI');
  }

  if (/\bitalian\b/.test(text)) {
    cuisines.push('ITALIAN');
  }

  if (/\bmexican\b/.test(text)) {
    cuisines.push('MEXICAN');
  }

  if (/\bturkish\b/.test(text)) {
    cuisines.push('TURKISH');
  }

  if (/\bfrench\b/.test(text)) {
    cuisines.push('FRENCH');
  }

  if (/\bseafood\b/.test(text)) {
    cuisines.push('SEAFOOD');
  }

  if (/\bbbq\b/.test(text)) {
    cuisines.push('BBQ');
  }

  return sortByKnownOrder(cuisines.filter((value) => VALID_CUISINES.includes(value)));
}

function buildSlug(record) {
  const existingSlug = cleanText(record.slug);
  const suffixMatch = existingSlug.match(/-([a-z0-9]{5})$/i);
  const suffix = suffixMatch ? suffixMatch[1].toLowerCase() : null;
  const namePart = toSlugPart(record.name);
  const cityPart = toSlugPart(record.address?.city);

  const parts = [];
  if (namePart) {
    parts.push(namePart);
  }

  if (cityPart && !namePart.endsWith(cityPart)) {
    parts.push(cityPart);
  }

  if (suffix) {
    parts.push(suffix);
  }

  return parts.join('-').replace(/-{2,}/g, '-');
}

function hasWeakAddressLine1(line1) {
  const value = cleanText(line1).toLowerCase();
  if (!value) return true;

  const weakExact = new Set([
    'located in the',
    'basement bar',
    'ponce city market',
  ]);

  if (weakExact.has(value)) return true;
  if (!/\d/.test(value) && !/\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|way|plaza|market|floor|suite|ste)\b/.test(value)) {
    return true;
  }

  return false;
}

function buildSportsEvidence(record, text) {
  const evidence = [];
  if (/(soccer)/.test(text)) evidence.push('soccer');
  if (/(sportsbar|sports bar|watch bar|watchbar|sports-viewing|sports-centric|sporting club|sporting kc|bullpen)/.test(text)) evidence.push('sports-bar');
  if (/(watching|watch party|sports on|televised|tvs?\b|big screens?|tons of tvs|lots of tvs|pitch\s*\d+)/.test(text)) evidence.push('screens');
  if (/(pub|ale house|watch bar|watchbar)/.test(text)) evidence.push('pub-bar');
  if ((record.googleTypes || []).includes('bar')) evidence.push('google-bar');
  return [...new Set(evidence)];
}

function sanitizeRecord(record, report) {
  const originalSlug = record.slug;
  const correction = MANUAL_CORRECTIONS[record.id];
  if (correction?.address) {
    Object.assign(record.address, correction.address);
    report.locationCorrectionsApplied.push({
      id: record.id,
      name: record.name,
      applied: correction.address,
    });
  }

  fillMissingDescriptions(record);

  const coverResult = stripGoogleApiKey(record.coverImageUrl);
  record.coverImageUrl = coverResult.value;
  if (coverResult.changed) {
    report.imageKeysStripped += 1;
  }

  record.galleryImageUrls = Array.isArray(record.galleryImageUrls)
    ? record.galleryImageUrls.map((url) => {
        const result = stripGoogleApiKey(url);
        if (result.changed) {
          report.imageKeysStripped += 1;
        }
        return result.value;
      })
    : [];

  const normalizedSlug = buildSlug(record);
  if (normalizedSlug && normalizedSlug !== originalSlug) {
    record.slug = normalizedSlug;
    report.slugChanges.push({
      id: record.id,
      name: record.name,
      from: originalSlug,
      to: normalizedSlug,
    });
  }

  record.priceRange = VALID_PRICE_RANGES.has(record.priceRange) ? record.priceRange : 'MID';

  const originalAmenities = Array.isArray(record.amenities) ? [...record.amenities] : [];
  const originalCuisineTags = Array.isArray(record.cuisineTags) ? [...record.cuisineTags] : [];
  const text = inferText(record);

  record.amenities = inferAmenities(record, text);
  record.vibes = inferVibes(record, text);
  record.cuisineTags = inferCuisineTags(text);

  if (originalAmenities.some((value) => !VALID_AMENITIES.includes(value))) {
    report.invalidOriginalAmenities.push({
      id: record.id,
      name: record.name,
      originalAmenities,
      sanitizedAmenities: record.amenities,
      sanitizedVibes: record.vibes,
    });
  }

  if (originalCuisineTags.some((value) => !VALID_CUISINES.includes(value)) || (originalCuisineTags.length === 1 && originalCuisineTags[0] === 'AMERICAN' && record.cuisineTags.length !== 1)) {
    report.rebuiltCuisineTags.push({
      id: record.id,
      name: record.name,
      originalCuisineTags,
      sanitizedCuisineTags: record.cuisineTags,
    });
  }

  if (!record.description || !record.shortDescription) {
    report.missingDescriptions.push({
      id: record.id,
      name: record.name,
      descriptionMissing: !record.description,
      shortDescriptionMissing: !record.shortDescription,
    });
  }

  if (!record.website || !record.phone) {
    report.missingContactInfo.push({
      id: record.id,
      name: record.name,
      websiteMissing: !record.website,
      phoneMissing: !record.phone,
    });
  }

  if (hasWeakAddressLine1(record.address?.line1)) {
    report.weakAddressLines.push({
      id: record.id,
      name: record.name,
      addressLine1: record.address?.line1 ?? null,
    });
  }

  const googleTypes = Array.isArray(record.googleTypes) ? record.googleTypes : [];
  if (googleTypes.includes('night_club') || googleTypes.includes('lodging')) {
    report.highRiskVenueTypes.push({
      id: record.id,
      name: record.name,
      googleTypes,
    });
  }

  const sportsEvidence = buildSportsEvidence(record, text);
  if (sportsEvidence.length === 0) {
    report.sportsEvidenceMissing.push({
      id: record.id,
      name: record.name,
      googleTypes,
    });
  }

  const reviewHint = REVIEW_HINTS[record.id];
  if (reviewHint) {
    report.locationReviewHints.push({
      id: record.id,
      name: record.name,
      currentCity: record.address?.city ?? null,
      currentState: record.address?.state ?? null,
      ...reviewHint,
    });
  }
}

function buildMarkdownReport(report, sanitizedRecords, inputPath) {
  const lines = [];
  lines.push('# Venue Export Sanitization Report');
  lines.push('');
  lines.push(`- Source: \`${inputPath}\``);
  lines.push(`- Records: ${sanitizedRecords.length}`);
  lines.push(`- Google photo URLs stripped of API keys: ${report.imageKeysStripped}`);
  lines.push(`- Slugs normalized: ${report.slugChanges.length}`);
  lines.push(`- High-confidence location corrections applied: ${report.locationCorrectionsApplied.length}`);
  lines.push(`- High-risk venue types for manual review: ${report.highRiskVenueTypes.length}`);
  lines.push(`- Weak address lines: ${report.weakAddressLines.length}`);
  lines.push(`- Missing sports evidence: ${report.sportsEvidenceMissing.length}`);
  lines.push('');

  if (report.locationCorrectionsApplied.length) {
    lines.push('## Applied Corrections');
    lines.push('');
    for (const item of report.locationCorrectionsApplied) {
      lines.push(`- ${item.name}: city -> ${item.applied.city}, state -> ${item.applied.state}, timezone -> ${item.applied.timezone}`);
    }
    lines.push('');
  }

  if (report.highRiskVenueTypes.length) {
    lines.push('## High-Risk Venue Types');
    lines.push('');
    for (const item of report.highRiskVenueTypes) {
      lines.push(`- ${item.name}: ${item.googleTypes.join(', ')}`);
    }
    lines.push('');
  }

  if (report.weakAddressLines.length) {
    lines.push('## Weak Address Lines');
    lines.push('');
    for (const item of report.weakAddressLines) {
      lines.push(`- ${item.name}: ${item.addressLine1 ?? '(missing)'}`);
    }
    lines.push('');
  }

  if (report.locationReviewHints.length) {
    lines.push('## Manual Location Review Hints');
    lines.push('');
    for (const item of report.locationReviewHints) {
      lines.push(`- ${item.name}: ${item.reason} Current ${item.currentCity}, ${item.currentState}; suggested ${item.suggestedCity}, ${item.suggestedState}.`);
    }
    lines.push('');
  }

  if (report.sportsEvidenceMissing.length) {
    lines.push('## Missing Sports Evidence');
    lines.push('');
    for (const item of report.sportsEvidenceMissing) {
      lines.push(`- ${item.name}: ${item.googleTypes.join(', ') || 'no google types'}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const { inputPath, outputDir } = parseArgs(process.argv);
  const rawRecords = readJson(inputPath);

  if (!Array.isArray(rawRecords)) {
    throw new Error('Input JSON must be an array of venue records.');
  }

  const sanitizedRecords = structuredClone(rawRecords);
  const report = {
    imageKeysStripped: 0,
    slugChanges: [],
    locationCorrectionsApplied: [],
    invalidOriginalAmenities: [],
    rebuiltCuisineTags: [],
    missingDescriptions: [],
    missingContactInfo: [],
    weakAddressLines: [],
    highRiskVenueTypes: [],
    sportsEvidenceMissing: [],
    locationReviewHints: [],
  };

  for (const record of sanitizedRecords) {
    sanitizeRecord(record, report);
  }

  mkdirSync(outputDir, { recursive: true });

  const sanitizedPath = path.join(outputDir, 'venues-export.sanitized.json');
  const reviewJsonPath = path.join(outputDir, 'venues-export.review.json');
  const reviewMdPath = path.join(outputDir, 'venues-export.review.md');

  writeJson(sanitizedPath, sanitizedRecords);
  writeJson(reviewJsonPath, {
    sourcePath: inputPath,
    recordCount: sanitizedRecords.length,
    ...report,
  });
  writeFileSync(reviewMdPath, buildMarkdownReport(report, sanitizedRecords, inputPath));

  console.log(JSON.stringify({
    inputPath,
    sanitizedPath,
    reviewJsonPath,
    reviewMdPath,
    recordCount: sanitizedRecords.length,
    imageKeysStripped: report.imageKeysStripped,
    slugChanges: report.slugChanges.length,
    locationCorrectionsApplied: report.locationCorrectionsApplied.length,
    highRiskVenueTypes: report.highRiskVenueTypes.length,
    weakAddressLines: report.weakAddressLines.length,
    sportsEvidenceMissing: report.sportsEvidenceMissing.length,
  }, null, 2));
}

main();
