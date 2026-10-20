import { pgTable, uuid, text, timestamp, boolean, bigint, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './schema';

export const broadcasts = pgTable('stream_broadcasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(), sport: text('sport').notNull(),
  description: text('description').notNull().default(''),
  keyHash: text('key_hash').notNull(), ended: boolean('ended').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ owner: index('stream_broadcasts_owner').on(t.ownerId) }));

export const streamVideos = pgTable('stream_videos', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(), sport: text('sport').notNull(), objectKey: text('object_key').notNull(),
  contentType: text('content_type').notNull(), fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  ready: boolean('ready').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ owner: index('stream_videos_owner').on(t.ownerId) }));

export const streamFavorites = pgTable('stream_favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  videoId: text('video_id').notNull(), title: text('title').notNull(), sport: text('sport').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ uniqueVideo: uniqueIndex('stream_favorites_owner_video').on(t.ownerId, t.videoId) }));
