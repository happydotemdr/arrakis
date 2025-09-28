#!/usr/bin/env bun

import { config } from 'dotenv'
import { searchConversations } from '@/lib/search/semantic-search'

// Load environment variables
config({ path: '.env.local' })

async function testSemanticSearch() {
  console.log('🧪 Testing Semantic Search Functionality...')

  const testQueries = [
    'Hello world',
    'database schema',
    'conversation capture',
    'arrakis system',
    'claude assistant'
  ]

  console.log(`\n📊 Testing ${testQueries.length} search queries`)

  for (const query of testQueries) {
    try {
      console.log(`\n🔍 Testing query: "${query}"`)

      const startTime = Date.now()

      // Test keyword search (should work even without embeddings)
      const keywordResults = await searchConversations({
        query,
        searchType: 'keyword',
        limit: 5,
        includeContext: false
      })

      const keywordTime = Date.now() - startTime

      console.log(`  📈 Keyword search: ${keywordResults.totalFound} results in ${keywordTime}ms`)

      if (keywordResults.results.length > 0) {
        console.log(`    ✅ Top result: "${keywordResults.results[0].content.substring(0, 80)}..."`)
      }

      // Test semantic search (will fail gracefully if no embeddings)
      try {
        const semanticStartTime = Date.now()

        const semanticResults = await searchConversations({
          query,
          searchType: 'semantic',
          limit: 5,
          includeContext: false
        })

        const semanticTime = Date.now() - semanticStartTime

        console.log(`  🧠 Semantic search: ${semanticResults.totalFound} results in ${semanticTime}ms`)

        if (semanticResults.results.length > 0) {
          const topResult = semanticResults.results[0]
          console.log(`    ✅ Top result (${(topResult.similarity! * 100).toFixed(1)}% match): "${topResult.content.substring(0, 80)}..."`)
        }
      } catch (error) {
        console.log(`  ⚠️  Semantic search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        console.log(`    💡 This is expected if embeddings haven't been generated yet`)
      }

    } catch (error) {
      console.error(`  ❌ Query "${query}" failed:`, error)
    }
  }

  console.log(`\n🎯 Test Summary:`)
  console.log(`  • Keyword search tests the existing database query functionality`)
  console.log(`  • Semantic search tests the vector embedding functionality`)
  console.log(`  • If semantic search fails, generate embeddings first with:`)
  console.log(`    bun run scripts/generate-embeddings.ts`)
  console.log(`\n📍 Next steps:`)
  console.log(`  1. Update OpenAI API key in .env.local`)
  console.log(`  2. Run: bun run scripts/generate-embeddings.ts`)
  console.log(`  3. Test semantic search again`)
  console.log(`  4. Open http://localhost:3001/search to test UI`)
}

// Run the test
testSemanticSearch()
  .then(() => {
    console.log('\n✅ Test completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error)
    process.exit(1)
  })