import type { Conversation, Message } from '@prisma/client'

export type ConversationWithMessages = Conversation & {
  messages: Message[]
}

export type ConversationWithLastMessage = Conversation & {
  messages: Message[]
  _count: {
    messages: number
  }
}

export interface CreateConversationInput {
  title: string
  description?: string
}

export interface CreateMessageInput {
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: Record<string, any>
}

export interface UpdateConversationInput {
  id: string
  title?: string
  description?: string
}