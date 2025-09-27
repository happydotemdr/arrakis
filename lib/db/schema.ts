import { relations } from 'drizzle-orm'
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// Users table - minimal for single-user start
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  settings: jsonb('settings').default('{}'),
})

// Sessions table
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  claudeSessionId: varchar('claude_session_id', { length: 255 }),
  title: varchar('title', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  metadata: jsonb('metadata').default('{}'),
})

// Messages table
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  sessionId: uuid('session_id')
    .references(() => sessions.id)
    .notNull(),
  role: varchar('role', { length: 20 }).notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  tokens: integer('tokens'),
  costUsd: decimal('cost_usd', { precision: 8, scale: 6 }),
  metadata: jsonb('metadata').default('{}'),
})

// Message embeddings table for vector search
export const messageEmbeddings = pgTable(
  'message_embeddings',
  {
    id: serial('id').primaryKey(),
    messageId: integer('message_id')
      .references(() => messages.id)
      .notNull(),
    embedding: text('embedding').notNull(), // Will store vector as text for now, pgvector later
    model: varchar('model', { length: 100 })
      .default('text-embedding-3-small')
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    messageIdIdx: index('idx_message_embeddings_message_id').on(
      table.messageId
    ),
  })
)

// Conversation tags table
export const conversationTags = pgTable('conversation_tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  color: varchar('color', { length: 7 }).default('#3b82f6').notNull(), // Hex color
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// Session tags junction table (many-to-many)
export const sessionTags = pgTable(
  'session_tags',
  {
    sessionId: uuid('session_id')
      .references(() => sessions.id)
      .notNull(),
    tagId: integer('tag_id')
      .references(() => conversationTags.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: index('idx_session_tags_primary').on(table.sessionId, table.tagId),
  })
)

// Conversation templates table
export const conversationTemplates = pgTable('conversation_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  template: text('template').notNull(), // Template content with placeholders
  category: varchar('category', { length: 100 }).default('general'),
  isPublic: boolean('is_public').default(false),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  usageCount: integer('usage_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  conversationTemplates: many(conversationTemplates),
}))

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  messages: many(messages),
  sessionTags: many(sessionTags),
}))

export const messagesRelations = relations(messages, ({ one, many }) => ({
  session: one(sessions, {
    fields: [messages.sessionId],
    references: [sessions.id],
  }),
  embeddings: many(messageEmbeddings),
}))

export const messageEmbeddingsRelations = relations(
  messageEmbeddings,
  ({ one }) => ({
    message: one(messages, {
      fields: [messageEmbeddings.messageId],
      references: [messages.id],
    }),
  })
)

export const conversationTagsRelations = relations(
  conversationTags,
  ({ many }) => ({
    sessionTags: many(sessionTags),
  })
)

export const sessionTagsRelations = relations(sessionTags, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionTags.sessionId],
    references: [sessions.id],
  }),
  tag: one(conversationTags, {
    fields: [sessionTags.tagId],
    references: [conversationTags.id],
  }),
}))

export const conversationTemplatesRelations = relations(
  conversationTemplates,
  ({ one }) => ({
    user: one(users, {
      fields: [conversationTemplates.userId],
      references: [users.id],
    }),
  })
)

// Enhanced embedding tables for Phase 6 RAG implementation
export const sessionEmbeddings = pgTable('session_embeddings', {
  id: serial('session_embedding_id').primaryKey(),
  sessionId: uuid('session_id')
    .references(() => sessions.id, { onDelete: 'cascade' })
    .notNull(),
  summaryText: text('summary_text').notNull(),
  embedding: text('embedding').notNull(), // Will be vector(1536) in production
  model: varchar('model', { length: 50 })
    .default('text-embedding-3-small')
    .notNull(),
  tokenCount: integer('token_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const embeddingQueue = pgTable(
  'embedding_queue',
  {
    id: serial('queue_id').primaryKey(),
    itemType: varchar('item_type', { length: 20 }).notNull(), // 'message' or 'session'
    itemId: varchar('item_id', { length: 100 }).notNull(), // message_id or session_id
    priority: integer('priority').default(5).notNull(), // 1 (highest) to 10 (lowest)
    status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, processing, completed, failed
    retryCount: integer('retry_count').default(0).notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => ({
    uniqueItem: unique().on(table.itemType, table.itemId),
  })
)

export const embeddingProcessingLog = pgTable('embedding_processing_log', {
  id: serial('log_id').primaryKey(),
  itemType: varchar('item_type', { length: 20 }).notNull(),
  itemId: varchar('item_id', { length: 100 }).notNull(),
  operation: varchar('operation', { length: 50 }).notNull(), // 'embed', 'reembed', 'delete'
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'error'
  processingTimeMs: integer('processing_time_ms'),
  tokenCount: integer('token_count'),
  chunkCount: integer('chunk_count').default(1),
  model: varchar('model', { length: 50 }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// Relations for new embedding tables
export const sessionEmbeddingsRelations = relations(
  sessionEmbeddings,
  ({ one }) => ({
    session: one(sessions, {
      fields: [sessionEmbeddings.sessionId],
      references: [sessions.id],
    }),
  })
)

// Export types
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
export type MessageEmbedding = typeof messageEmbeddings.$inferSelect
export type NewMessageEmbedding = typeof messageEmbeddings.$inferInsert
export type ConversationTag = typeof conversationTags.$inferSelect
export type NewConversationTag = typeof conversationTags.$inferInsert
export type SessionTag = typeof sessionTags.$inferSelect
export type NewSessionTag = typeof sessionTags.$inferInsert
export type ConversationTemplate = typeof conversationTemplates.$inferSelect
export type NewConversationTemplate = typeof conversationTemplates.$inferInsert
export type SessionEmbedding = typeof sessionEmbeddings.$inferSelect
export type NewSessionEmbedding = typeof sessionEmbeddings.$inferInsert
export type EmbeddingQueue = typeof embeddingQueue.$inferSelect
export type NewEmbeddingQueue = typeof embeddingQueue.$inferInsert
export type EmbeddingProcessingLog = typeof embeddingProcessingLog.$inferSelect
export type NewEmbeddingProcessingLog = typeof embeddingProcessingLog.$inferInsert
