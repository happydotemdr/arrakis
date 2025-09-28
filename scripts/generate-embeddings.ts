#!/usr/bin/env bun

import { config } from 'dotenv'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { messages, messageEmbeddings } from '@/lib/db/schema'
import OpenAI from 'openai'

// Load environment variables
config({ path: '.env.local' })

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

async function processExistingMessages() {
  console.log('🚀 Starting embedding generation for existing messages...')

  try {
    // Get all messages without embeddings
    const unprocessedMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.embeddingStatus, 'pending'))
      .orderBy(messages.createdAt)

    console.log(`📊 Found ${unprocessedMessages.length} messages to process`)

    if (unprocessedMessages.length === 0) {
      console.log('✅ No messages need embedding processing')
      return
    }

    let processed = 0
    let failed = 0

    for (const message of unprocessedMessages) {
      try {
        console.log(`🔄 Processing message ${message.id}: "${message.content.substring(0, 50)}..."`)

        // Generate embedding
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: message.content,
        })

        const embedding = response.data[0].embedding

        // Store embedding
        await db.insert(messageEmbeddings).values({
          messageId: message.id,
          embedding: JSON.stringify(embedding),
          model: 'text-embedding-3-small',
        })

        // Update message status
        await db
          .update(messages)
          .set({ embeddingStatus: 'completed' })
          .where(eq(messages.id, message.id))

        processed++
        console.log(`✅ Processed message ${message.id} (${processed}/${unprocessedMessages.length})`)

        // Small delay to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        failed++
        console.error(`❌ Failed to process message ${message.id}:`, error)

        // Update status to failed
        await db
          .update(messages)
          .set({ embeddingStatus: 'failed' })
          .where(eq(messages.id, message.id))
      }
    }

    console.log(`\n📈 Processing complete!`)
    console.log(`✅ Successfully processed: ${processed} messages`)
    console.log(`❌ Failed: ${failed} messages`)

    if (processed > 0) {
      console.log(`\n🎯 Next steps:`)
      console.log(`1. Test semantic search with: bun run scripts/test-semantic-search.ts`)
      console.log(`2. Create the search API endpoint`)
      console.log(`3. Build the search UI component`)
    }

  } catch (error) {
    console.error('💥 Script failed:', error)
    process.exit(1)
  }
}

// Run the script
processExistingMessages()
  .then(() => {
    console.log('🏁 Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Script failed:', error)
    process.exit(1)
  })