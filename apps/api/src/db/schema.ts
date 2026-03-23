import {
    pgTable, pgEnum, uuid, varchar, text, integer, boolean,
    timestamp, decimal, jsonb, inet, uniqueIndex, index, primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ──────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['USER', 'VENUE_OWNER', 'BUSINESS', 'ADMIN', 'SUPER_ADMIN']);
export const matchStatusEnum = pgEnum('match_status', [
    'SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'CANCELLED', 'SUSPENDED',
]);
export const bookingStatusEnum = pgEnum('booking_status', [
    'PENDING', 'CONFIRMED', 'CANCELLED_BY_USER', 'CANCELLED_BY_VENUE', 'NO_SHOW',
]);
export const notificationTypeEnum = pgEnum('notification_type', [
    'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'VENUE_POST', 'MATCH_REMINDER', 'VENUE_NOTIFICATION', 'SYSTEM',
]);
export const priceRangeEnum = pgEnum('price_range', ['BUDGET', 'MID', 'UPSCALE', 'LUXURY']);
export const venueAttributeTypeEnum = pgEnum('venue_attribute_type', ['AMENITY', 'VIBE', 'CUISINE']);
export const claimStatusEnum = pgEnum('claim_status', ['PENDING', 'APPROVED', 'REJECTED']);
export const discountTypeEnum = pgEnum('discount_type', ['PERCENTAGE', 'FIXED', 'FREE_ITEM']);
export const matchEventFormatEnum = pgEnum('match_event_format', ['HEAD_TO_HEAD', 'SINGLE_EVENT']);
export const blogPublishStatusEnum = pgEnum('blog_publish_status', ['DRAFT', 'PUBLISHED']);
export const blogCommentStatusEnum = pgEnum('blog_comment_status', ['PENDING', 'APPROVED', 'REJECTED']);

// ─── Users ──────────────────────────────────────

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    emailVerificationToken: varchar('email_verification_token', { length: 255 }),
    emailVerificationExpiresAt: timestamp('email_verification_expires_at'),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    avatarUrl: varchar('avatar_url'),
    avatarS3Key: varchar('avatar_s3_key'),
    role: userRoleEnum('role').default('USER').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    isSuspended: boolean('is_suspended').default(false).notNull(),
    suspensionReason: text('suspension_reason'),
    failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
    lockedUntil: timestamp('locked_until'),
    lastLoginAt: timestamp('last_login_at'),
    lastLoginIp: varchar('last_login_ip', { length: 45 }),
    timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),
    locale: varchar('locale', { length: 10 }).default('en').notNull(),
    pushToken: varchar('push_token'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => [
    index('users_email_idx').on(table.email),
]);

// ─── Refresh Token Sessions ─────────────────────

export const refreshTokenSessions = pgTable('refresh_token_sessions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    familyId: uuid('family_id').notNull(),
    deviceInfo: jsonb('device_info').$type<{ userAgent?: string; ipHash?: string; deviceName?: string }>(),
    expiresAt: timestamp('expires_at').notNull(),
    lastUsedAt: timestamp('last_used_at'),
    isRevoked: boolean('is_revoked').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
    index('refresh_tokens_user_idx').on(table.userId),
    index('refresh_tokens_family_idx').on(table.familyId),
]);

// ─── Audit Logs ─────────────────────────────────

export const auditLogs = pgTable('audit_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }),
    entityId: uuid('entity_id'),
    metadata: jsonb('metadata'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
    index('audit_user_idx').on(table.userId),
    index('audit_action_idx').on(table.action),
]);

// ─── Leagues ────────────────────────────────────

export const sports = pgTable('sports', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 80 }).notNull().unique(),
    slug: varchar('slug', { length: 80 }).notNull().unique(),
    shortName: varchar('short_name', { length: 20 }),
    sortOrder: integer('sort_order').default(0),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('sports_active_idx').on(table.isActive),
    index('sports_sort_idx').on(table.sortOrder),
]);

export const leagues = pgTable('leagues', {
    id: uuid('id').primaryKey().defaultRandom(),
    sportId: uuid('sport_id').notNull().references(() => sports.id),
    name: varchar('name', { length: 100 }).notNull(),
    shortName: varchar('short_name', { length: 20 }),
    logoUrl: varchar('logo_url'),
    externalId: varchar('external_id', { length: 20 }).unique(),
    country: varchar('country', { length: 50 }),
    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('leagues_sport_idx').on(table.sportId),
]);

// ─── Teams ──────────────────────────────────────

export const teams = pgTable('teams', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 150 }).notNull(),
    shortName: varchar('short_name', { length: 30 }),
    crestUrl: varchar('crest_url'),
    leagueId: uuid('league_id').references(() => leagues.id),
    externalId: varchar('external_id', { length: 20 }).unique(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
    index('teams_league_idx').on(table.leagueId),
]);

export const stadiums = pgTable('stadiums', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    city: varchar('city', { length: 100 }),
    country: varchar('country', { length: 100 }),
    externalId: varchar('external_id', { length: 50 }).unique(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('stadiums_name_idx').on(table.name),
    index('stadiums_city_idx').on(table.city),
]);

// ─── Matches ────────────────────────────────────

export const matches = pgTable('matches', {
    id: uuid('id').primaryKey().defaultRandom(),
    externalMatchId: varchar('external_match_id', { length: 50 }).unique(),
    leagueId: uuid('league_id').references(() => leagues.id),
    isFeatured: boolean('is_featured').default(false).notNull(),
    eventFormat: matchEventFormatEnum('event_format').default('HEAD_TO_HEAD').notNull(),
    eventTitle: varchar('event_title', { length: 200 }),
    eventSubtitle: varchar('event_subtitle', { length: 200 }),
    homeTeamId: uuid('home_team_id').references(() => teams.id),
    awayTeamId: uuid('away_team_id').references(() => teams.id),
    stadiumId: uuid('stadium_id').references(() => stadiums.id),
    homeTeamName: varchar('home_team_name', { length: 150 }),
    awayTeamName: varchar('away_team_name', { length: 150 }),
    homeTeamCrestUrl: varchar('home_team_crest_url'),
    awayTeamCrestUrl: varchar('away_team_crest_url'),
    homeScore: integer('home_score'),
    awayScore: integer('away_score'),
    matchDateUtc: timestamp('match_date_utc').notNull(),
    status: matchStatusEnum('status').default('SCHEDULED').notNull(),
    matchDay: integer('match_day'),
    stage: varchar('stage', { length: 50 }),
    venueName: varchar('venue_name', { length: 200 }),
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('matches_league_idx').on(table.leagueId),
    index('matches_date_idx').on(table.matchDateUtc),
    index('matches_status_idx').on(table.status),
]);

// ─── Venues ─────────────────────────────────────

export const venues = pgTable('venues', {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').notNull().references(() => users.id),
    name: varchar('name', { length: 150 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull().unique(),
    description: text('description'),
    shortDescription: varchar('short_description', { length: 280 }),
    addressLine1: varchar('address_line1', { length: 255 }).notNull(),
    addressLine2: varchar('address_line2', { length: 255 }),
    city: varchar('city', { length: 100 }).notNull(),
    stateProvince: varchar('state_province', { length: 100 }),
    country: varchar('country', { length: 100 }).notNull(),
    postalCode: varchar('postal_code', { length: 20 }),
    lat: decimal('lat', { precision: 10, scale: 8 }).notNull(),
    lng: decimal('lng', { precision: 11, scale: 8 }).notNull(),
    timezone: varchar('timezone', { length: 50 }).notNull(),
    coverImageUrl: varchar('cover_image_url'),
    coverImageS3Key: varchar('cover_image_s3_key'),
    galleryS3Keys: text('gallery_s3_keys').array().default([]),
    phone: varchar('phone', { length: 30 }),
    website: varchar('website', { length: 255 }),
    instagramHandle: varchar('instagram_handle', { length: 100 }),
    googleMapsUrl: varchar('google_maps_url'),
    capacity: integer('capacity'),
    averageRating: decimal('average_rating', { precision: 3, scale: 2 }).default('0'),
    totalReviews: integer('total_reviews').default(0),
    ratingOverride: decimal('rating_override', { precision: 3, scale: 2 }),
    reviewCountOverride: integer('review_count_override'),
    amenities: text('amenities').array().notNull().default([]),
    vibes: text('vibes').array().notNull().default([]),
    cuisineTags: text('cuisine_tags').array().notNull().default([]),
    priceRange: priceRangeEnum('price_range').default('MID'),
    isVerified: boolean('is_verified').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    isFeatured: boolean('is_featured').default(false).notNull(),
    stripeAccountId: varchar('stripe_account_id'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => [
    index('venues_owner_idx').on(table.ownerId),
    index('venues_city_idx').on(table.city),
    index('venues_slug_idx').on(table.slug),
]);

export const venueAttributes = pgTable('venue_attributes', {
    id: uuid('id').primaryKey().defaultRandom(),
    type: venueAttributeTypeEnum('type').notNull(),
    label: varchar('label', { length: 80 }).notNull(),
    slug: varchar('slug', { length: 80 }).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('venue_attributes_type_slug_unique').on(table.type, table.slug),
    index('venue_attributes_type_idx').on(table.type),
    index('venue_attributes_active_idx').on(table.isActive),
    index('venue_attributes_sort_idx').on(table.type, table.sortOrder),
]);

// ─── Venue Events ───────────────────────────────

export const venueEvents = pgTable('venue_events', {
    id: uuid('id').primaryKey().defaultRandom(),
    venueId: uuid('venue_id').notNull().references(() => venues.id),
    matchId: uuid('match_id').notNull().references(() => matches.id),
    isActive: boolean('is_active').default(true).notNull(),
    bookingLimit: integer('booking_limit'),
    confirmedBookingsCount: integer('confirmed_bookings_count').default(0).notNull(),
    specialNotes: text('special_notes'),
    customPrice: decimal('custom_price', { precision: 10, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('USD'),
    doorsOpenAt: timestamp('doors_open_at'),
    requiresApproval: boolean('requires_approval').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('venue_event_unique').on(table.venueId, table.matchId),
    index('venue_events_venue_idx').on(table.venueId),
    index('venue_events_match_idx').on(table.matchId),
]);

// ─── Venue Custom Events ────────────────────────

export const venueCustomEvents = pgTable('venue_custom_events', {
    id: uuid('id').primaryKey().defaultRandom(),
    venueId: uuid('venue_id').notNull().references(() => venues.id),
    title: varchar('title', { length: 160 }).notNull(),
    description: text('description'),
    eventTypeTags: text('event_type_tags').array().notNull().default([]),
    startsAt: timestamp('starts_at').notNull(),
    endsAt: timestamp('ends_at').notNull(),
    imageUrl: varchar('image_url'),
    imageS3Key: varchar('image_s3_key'),
    bookingNotes: text('booking_notes'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('venue_custom_events_venue_idx').on(table.venueId),
    index('venue_custom_events_starts_idx').on(table.startsAt),
    index('venue_custom_events_ends_idx').on(table.endsAt),
]);

// ─── Bookings ───────────────────────────────────

export const bookings = pgTable('bookings', {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingReference: varchar('booking_reference', { length: 12 }).notNull().unique(),
    userId: uuid('user_id').notNull().references(() => users.id),
    venueEventId: uuid('venue_event_id').notNull().references(() => venueEvents.id),
    partySize: integer('party_size').notNull(),
    specialRequests: text('special_requests'),
    status: bookingStatusEnum('status').default('PENDING').notNull(),
    cancellationReason: text('cancellation_reason'),
    cancelledAt: timestamp('cancelled_at'),
    cancelledBy: uuid('cancelled_by').references(() => users.id),
    reminderSentAt: timestamp('reminder_sent_at'),
    checkInAt: timestamp('check_in_at'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('bookings_user_idx').on(table.userId),
    index('bookings_event_idx').on(table.venueEventId),
    index('bookings_status_idx').on(table.status),
    index('bookings_ref_idx').on(table.bookingReference),
]);

// ─── Menu Categories ────────────────────────────

export const menuCategories = pgTable('menu_categories', {
    id: uuid('id').primaryKey().defaultRandom(),
    venueId: uuid('venue_id').notNull().references(() => venues.id),
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 500 }),
    sortOrder: integer('sort_order').default(0),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
    index('menu_cats_venue_idx').on(table.venueId),
]);

// ─── Menu Items ─────────────────────────────────

export const menuItems = pgTable('menu_items', {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id').notNull().references(() => menuCategories.id),
    venueId: uuid('venue_id').notNull().references(() => venues.id),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    price: decimal('price', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('USD'),
    imageUrl: varchar('image_url'),
    imageS3Key: varchar('image_s3_key'),
    isAvailable: boolean('is_available').default(true).notNull(),
    isFeatured: boolean('is_featured').default(false),
    dietaryTags: text('dietary_tags').array().default([]),
    allergens: text('allergens').array().default([]),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('menu_items_cat_idx').on(table.categoryId),
    index('menu_items_venue_idx').on(table.venueId),
]);

// ─── Posts ───────────────────────────────────────

export const posts = pgTable('posts', {
    id: uuid('id').primaryKey().defaultRandom(),
    venueId: uuid('venue_id').notNull().references(() => venues.id),
    authorId: uuid('author_id').notNull().references(() => users.id),
    content: text('content').notNull(),
    imageS3Keys: text('image_s3_keys').array().default([]),
    imageUrls: text('image_urls').array().default([]),
    matchId: uuid('match_id').references(() => matches.id),
    isPublished: boolean('is_published').default(true).notNull(),
    scheduledPublishAt: timestamp('scheduled_publish_at'),
    viewsCount: integer('views_count').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => [
    index('posts_venue_idx').on(table.venueId),
    index('posts_author_idx').on(table.authorId),
]);

export const blogCategories = pgTable('blog_categories', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 160 }).notNull().unique(),
    description: text('description'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('blog_categories_active_idx').on(table.isActive),
    index('blog_categories_sort_idx').on(table.sortOrder),
]);

export const blogPosts = pgTable('blog_posts', {
    id: uuid('id').primaryKey().defaultRandom(),
    authorId: uuid('author_id').notNull().references(() => users.id),
    title: varchar('title', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 220 }).notNull().unique(),
    excerpt: varchar('excerpt', { length: 500 }),
    featuredImageUrl: varchar('featured_image_url'),
    featuredImageS3Key: varchar('featured_image_s3_key'),
    contentJson: jsonb('content_json').default({}).notNull(),
    contentHtml: text('content_html').default('').notNull(),
    status: blogPublishStatusEnum('status').default('DRAFT').notNull(),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => [
    index('blog_posts_status_idx').on(table.status),
    index('blog_posts_published_at_idx').on(table.publishedAt),
    index('blog_posts_author_idx').on(table.authorId),
]);

export const blogPostCategories = pgTable('blog_post_categories', {
    postId: uuid('post_id').notNull().references(() => blogPosts.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').notNull().references(() => blogCategories.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
    primaryKey({ columns: [table.postId, table.categoryId] }),
]);

export const blogComments = pgTable('blog_comments', {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id').notNull().references(() => blogPosts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    status: blogCommentStatusEnum('status').default('PENDING').notNull(),
    moderatedBy: uuid('moderated_by').references(() => users.id),
    moderatedAt: timestamp('moderated_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('blog_comments_post_idx').on(table.postId),
    index('blog_comments_status_idx').on(table.status),
    index('blog_comments_user_idx').on(table.userId),
]);

// ─── Follows ────────────────────────────────────

export const follows = pgTable('follows', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    venueId: uuid('venue_id').notNull().references(() => venues.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('follows_unique').on(table.userId, table.venueId),
    index('follows_user_idx').on(table.userId),
    index('follows_venue_idx').on(table.venueId),
]);

// ─── Reviews ────────────────────────────────────

export const reviews = pgTable('reviews', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    venueId: uuid('venue_id').notNull().references(() => venues.id),
    venueEventId: uuid('venue_event_id').references(() => venueEvents.id),
    bookingId: uuid('booking_id').references(() => bookings.id),
    rating: integer('rating').notNull(),
    title: varchar('title', { length: 200 }),
    content: text('content'),
    ownerReply: text('owner_reply'),
    ownerRepliedAt: timestamp('owner_replied_at'),
    isVerifiedVisit: boolean('is_verified_visit').default(false),
    isFlagged: boolean('is_flagged').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
    index('reviews_venue_idx').on(table.venueId),
    index('reviews_user_idx').on(table.userId),
]);

// ─── Notifications ──────────────────────────────

export const notifications = pgTable('notifications', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    actionUrl: varchar('action_url'),
    imageUrl: varchar('image_url'),
    data: jsonb('data').default({}),
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
    index('notifications_user_idx').on(table.userId),
    index('notifications_read_idx').on(table.isRead),
]);

// ─── User Team Interests ────────────────────────

export const userTeamInterests = pgTable('user_team_interests', {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
    primaryKey({ columns: [table.userId, table.teamId] }),
]);

// ─── Waitlist ───────────────────────────────────

export const waitlist = pgTable('waitlist', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    venueEventId: uuid('venue_event_id').notNull().references(() => venueEvents.id),
    partySize: integer('party_size').notNull(),
    position: integer('position').notNull(),
    notifiedAt: timestamp('notified_at'),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
    uniqueIndex('waitlist_unique').on(table.userId, table.venueEventId),
]);

// ─── Venue Claims ───────────────────────────────

export const venueClaims = pgTable('venue_claims', {
    id: uuid('id').primaryKey().defaultRandom(),
    venueId: uuid('venue_id').notNull().references(() => venues.id),
    claimantUserId: uuid('claimant_user_id').notNull().references(() => users.id),
    status: claimStatusEnum('status').default('PENDING').notNull(),
    verificationDocuments: text('verification_documents').array().default([]),
    notes: text('notes'),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Promotions ─────────────────────────────────

export const promotions = pgTable('promotions', {
    id: uuid('id').primaryKey().defaultRandom(),
    venueId: uuid('venue_id').notNull().references(() => venues.id),
    venueEventId: uuid('venue_event_id').references(() => venueEvents.id),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    discountType: discountTypeEnum('discount_type').notNull(),
    discountValue: decimal('discount_value', { precision: 10, scale: 2 }).notNull(),
    code: varchar('code', { length: 50 }).unique(),
    maxUses: integer('max_uses'),
    usedCount: integer('used_count').default(0),
    validFrom: timestamp('valid_from').notNull(),
    validUntil: timestamp('valid_until').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Sync History ───────────────────────────────

export const syncHistory = pgTable('sync_history', {
    id: uuid('id').primaryKey().defaultRandom(),
    leagueId: uuid('league_id').references(() => leagues.id),
    status: varchar('status', { length: 20 }).notNull(),
    matchesUpserted: integer('matches_upserted').default(0),
    teamsUpserted: integer('teams_upserted').default(0),
    errorMessage: text('error_message'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Relations ──────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
    refreshTokenSessions: many(refreshTokenSessions),
    bookings: many(bookings),
    reviews: many(reviews),
    follows: many(follows),
    notifications: many(notifications),
    teamInterests: many(userTeamInterests),
    venues: many(venues),
    blogPosts: many(blogPosts),
    blogComments: many(blogComments),
}));

export const venuesRelations = relations(venues, ({ one, many }) => ({
    owner: one(users, { fields: [venues.ownerId], references: [users.id] }),
    events: many(venueEvents),
    customEvents: many(venueCustomEvents),
    menuCategories: many(menuCategories),
    posts: many(posts),
    follows: many(follows),
    reviews: many(reviews),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
    league: one(leagues, { fields: [matches.leagueId], references: [leagues.id] }),
    homeTeam: one(teams, { fields: [matches.homeTeamId], references: [teams.id], relationName: 'homeTeam' }),
    awayTeam: one(teams, { fields: [matches.awayTeamId], references: [teams.id], relationName: 'awayTeam' }),
    stadium: one(stadiums, { fields: [matches.stadiumId], references: [stadiums.id] }),
    venueEvents: many(venueEvents),
}));

export const venueEventsRelations = relations(venueEvents, ({ one, many }) => ({
    venue: one(venues, { fields: [venueEvents.venueId], references: [venues.id] }),
    match: one(matches, { fields: [venueEvents.matchId], references: [matches.id] }),
    bookings: many(bookings),
}));

export const venueCustomEventsRelations = relations(venueCustomEvents, ({ one }) => ({
    venue: one(venues, { fields: [venueCustomEvents.venueId], references: [venues.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
    user: one(users, { fields: [bookings.userId], references: [users.id] }),
    venueEvent: one(venueEvents, { fields: [bookings.venueEventId], references: [venueEvents.id] }),
}));

export const sportsRelations = relations(sports, ({ many }) => ({
    leagues: many(leagues),
}));

export const leaguesRelations = relations(leagues, ({ one, many }) => ({
    sport: one(sports, { fields: [leagues.sportId], references: [sports.id] }),
    teams: many(teams),
    matches: many(matches),
}));

export const teamsRelations = relations(teams, ({ one }) => ({
    league: one(leagues, { fields: [teams.leagueId], references: [leagues.id] }),
}));

export const stadiumsRelations = relations(stadiums, ({ many }) => ({
    matches: many(matches),
}));

export const venueAttributesRelations = relations(venueAttributes, () => ({}));

export const blogCategoriesRelations = relations(blogCategories, ({ many }) => ({
    postCategories: many(blogPostCategories),
}));

export const blogPostsRelations = relations(blogPosts, ({ one, many }) => ({
    author: one(users, { fields: [blogPosts.authorId], references: [users.id] }),
    categories: many(blogPostCategories),
    comments: many(blogComments),
}));

export const blogPostCategoriesRelations = relations(blogPostCategories, ({ one }) => ({
    post: one(blogPosts, { fields: [blogPostCategories.postId], references: [blogPosts.id] }),
    category: one(blogCategories, { fields: [blogPostCategories.categoryId], references: [blogCategories.id] }),
}));

export const blogCommentsRelations = relations(blogComments, ({ one }) => ({
    post: one(blogPosts, { fields: [blogComments.postId], references: [blogPosts.id] }),
    user: one(users, { fields: [blogComments.userId], references: [users.id], relationName: 'blogCommentAuthor' }),
    moderator: one(users, { fields: [blogComments.moderatedBy], references: [users.id], relationName: 'blogCommentModerator' }),
}));
