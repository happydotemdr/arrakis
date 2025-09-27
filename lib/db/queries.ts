import { eq, desc, and, sql } from 'drizzle-orm'
import { db } from './index'
import { users, sessions, messages, messageEmbeddings } from './schema'
import type {
  NewUser,
  NewSession,
  NewMessage,
  NewMessageEmbedding,
} from './schema'

// User operations
export async function createUser(data: NewUser) {
  const [user] = await db.insert(users).values(data).returning()
  return user
}

export async function getUserByUsername(username: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
  return user
}

export async function getOrCreateUser(username: string) {
  let user = await getUserByUsername(username)
  if (!user) {
    user = await createUser({ username })
  }
  return user
}

// Session operations
export async function createSession(data: NewSession) {
  const [session] = await db.insert(sessions).values(data).returning()
  return session
}

export async function getSessionById(id: string) {
  const [session] = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      status: sessions.status,
      createdAt: sessions.createdAt,
      updatedAt: sessions.updatedAt,
      metadata: sessions.metadata,
      claudeSessionId: sessions.claudeSessionId,
      userId: sessions.userId,
      messageCount: sql<number>`(
        SELECT COUNT(*) FROM ${messages}
        WHERE ${messages.sessionId} = ${sessions.id}
      )`,
    })
    .from(sessions)
    .where(eq(sessions.id, id))
  return session
}

export async function getSessionsByUserId(userId: number) {
  return db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.updatedAt))
}

export async function updateSessionTitle(id: string, title: string) {
  const [session] = await db
    .update(sessions)
    .set({ title, updatedAt: new Date() })
    .where(eq(sessions.id, id))
    .returning()
  return session
}

// Message operations
export async function createMessage(data: NewMessage) {
  const [message] = await db.insert(messages).values(data).returning()
  return message
}

export async function getMessagesBySessionId(sessionId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(messages.createdAt)
}

export async function getRecentMessages(limit = 50) {
  return db
    .select({
      id: messages.id,
      content: messages.content,
      role: messages.role,
      createdAt: messages.createdAt,
      sessionId: messages.sessionId,
      sessionTitle: sessions.title,
    })
    .from(messages)
    .leftJoin(sessions, eq(messages.sessionId, sessions.id))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
}

// Message embedding operations
export async function createMessageEmbedding(data: NewMessageEmbedding) {
  const [embedding] = await db
    .insert(messageEmbeddings)
    .values(data)
    .returning()
  return embedding
}

export async function getMessageEmbedding(messageId: number) {
  const [embedding] = await db
    .select()
    .from(messageEmbeddings)
    .where(eq(messageEmbeddings.messageId, messageId))
  return embedding
}

// Search operations (basic for now, will enhance with vector search later)
export async function searchMessages(query: string, limit = 20) {
  return db
    .select({
      id: messages.id,
      content: messages.content,
      role: messages.role,
      createdAt: messages.createdAt,
      sessionId: messages.sessionId,
      sessionTitle: sessions.title,
    })
    .from(messages)
    .leftJoin(sessions, eq(messages.sessionId, sessions.id))
    .where(sql`${messages.content} ILIKE ${`%${query}%`}`)
    .orderBy(desc(messages.createdAt))
    .limit(limit)
}

// Analytics operations
export async function getMessageCount() {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
  return result.count
}

export async function getSessionCount() {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions)
  return result.count
}

// Additional session operations for tRPC
export async function getSessions(options: {
  filters?: any
  limit?: number
  cursor?: string
}) {
  const { limit = 20, cursor } = options

  return db
    .select({
      id: sessions.id,
      title: sessions.title,
      status: sessions.status,
      createdAt: sessions.createdAt,
      updatedAt: sessions.updatedAt,
      metadata: sessions.metadata,
      claudeSessionId: sessions.claudeSessionId,
      messageCount: sql<number>`(
        SELECT COUNT(*) FROM ${messages}
        WHERE ${messages.sessionId} = ${sessions.id}
      )`,
    })
    .from(sessions)
    .orderBy(desc(sessions.updatedAt))
    .limit(limit)
}

export async function getSessionMessages(
  sessionId: string,
  options: { limit?: number; offset?: number } = {}
) {
  const { limit = 50, offset = 0 } = options

  return db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(messages.createdAt)
    .limit(limit)
    .offset(offset)
}
