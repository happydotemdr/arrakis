#!/usr/bin/env bun

import {
  getMessageCount,
  getSessionCount,
  getRecentMessages,
} from '../lib/db/queries'

async function testDatabase() {
  console.log('🧪 Testing database connection and ORM...')

  try {
    // Test basic queries
    const messageCount = await getMessageCount()
    const sessionCount = await getSessionCount()

    console.log('✅ Database connection successful!')
    console.log(
      `📊 Current stats: ${messageCount} messages, ${sessionCount} sessions`
    )

    // Test complex query
    const recentMessages = await getRecentMessages(5)
    console.log('✅ Complex queries working!')
    console.log(`📝 Recent messages: ${recentMessages.length} found`)

    if (recentMessages.length > 0) {
      console.log(
        '   Sample message:',
        recentMessages[0].content.substring(0, 50) + '...'
      )
    }

    console.log('🎉 Database ORM test completed successfully!')
  } catch (error) {
    console.error('❌ Database test failed:', error)
    process.exit(1)
  }
}

testDatabase()
  .catch(console.error)
  .finally(() => process.exit(0))
