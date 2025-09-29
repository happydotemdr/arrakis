import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Clean existing data
  await prisma.conversationEmbedding.deleteMany()
  await prisma.toolUse.deleteMany()
  await prisma.message.deleteMany()
  await prisma.conversation.deleteMany()

  console.log('✨ Cleaned existing data')

  // Create sample conversations
  const conversation1 = await prisma.conversation.create({
    data: {
      sessionId: 'claude-session-123',
      projectPath: 'C:\\projects\\arrakis',
      title: 'Setting up Prisma with pgvector',
      description: 'Initial database schema configuration with vector embeddings',
      metadata: {
        environment: 'development',
        claudeModel: 'claude-3-opus',
        tags: ['database', 'prisma', 'pgvector'],
      },
      messages: {
        create: [
          {
            role: 'user',
            content: 'Set up Prisma with PostgreSQL and pgvector extension',
            timestamp: new Date('2025-09-29T10:00:00Z'),
            metadata: {
              wordCount: 9,
              language: 'en',
            },
          },
          {
            role: 'assistant',
            content: 'I will set up Prisma with PostgreSQL and pgvector. First, let me check your current configuration...',
            timestamp: new Date('2025-09-29T10:00:05Z'),
            toolCalls: [
              {
                tool: 'Read',
                parameters: { file_path: 'package.json' },
              },
              {
                tool: 'Edit',
                parameters: { file_path: 'prisma/schema.prisma' },
              },
            ],
            metadata: {
              wordCount: 16,
              language: 'en',
            },
            toolUses: {
              create: [
                {
                  toolName: 'Read',
                  parameters: { file_path: 'package.json' },
                  response: { success: true, content: '...' },
                  duration: 125,
                  status: 'success',
                  timestamp: new Date('2025-09-29T10:00:06Z'),
                },
                {
                  toolName: 'Edit',
                  parameters: { file_path: 'prisma/schema.prisma' },
                  response: { success: true, linesChanged: 45 },
                  duration: 250,
                  status: 'success',
                  timestamp: new Date('2025-09-29T10:00:08Z'),
                },
              ],
            },
          },
          {
            role: 'user',
            content: 'Great! Now create the migration and seed file',
            timestamp: new Date('2025-09-29T10:01:00Z'),
            metadata: {
              wordCount: 8,
              language: 'en',
            },
          },
        ],
      },
    },
  })

  const conversation2 = await prisma.conversation.create({
    data: {
      sessionId: 'claude-session-456',
      projectPath: 'C:\\projects\\arrakis',
      title: 'Implementing semantic search',
      description: 'Adding vector embeddings for conversation search',
      startedAt: new Date('2025-09-29T14:00:00Z'),
      endedAt: new Date('2025-09-29T14:30:00Z'),
      metadata: {
        environment: 'development',
        claudeModel: 'claude-3-opus',
        tags: ['search', 'embeddings', 'ai'],
      },
      messages: {
        create: [
          {
            role: 'user',
            content: 'How can we implement semantic search using the pgvector embeddings?',
            timestamp: new Date('2025-09-29T14:00:00Z'),
          },
          {
            role: 'assistant',
            content: 'To implement semantic search with pgvector, we need to: 1) Generate embeddings for text chunks, 2) Store them in the vector column, 3) Use cosine similarity for search. Here is an example implementation...',
            timestamp: new Date('2025-09-29T14:00:10Z'),
            metadata: {
              codeBlocks: 3,
              languages: ['typescript', 'sql'],
            },
          },
          {
            role: 'user',
            content: 'Can you show me how to query for similar conversations?',
            timestamp: new Date('2025-09-29T14:05:00Z'),
          },
          {
            role: 'assistant',
            content: 'Certainly! Here is how to query for similar conversations using vector similarity...',
            timestamp: new Date('2025-09-29T14:05:15Z'),
            toolCalls: [
              {
                tool: 'Write',
                parameters: {
                  file_path: 'src/lib/search.ts',
                  content: '// Vector search implementation',
                },
              },
            ],
            toolUses: {
              create: {
                toolName: 'Write',
                parameters: {
                  file_path: 'src/lib/search.ts',
                  content: '// Vector search implementation',
                },
                response: { success: true, bytesWritten: 2456 },
                duration: 180,
                status: 'success',
                timestamp: new Date('2025-09-29T14:05:20Z'),
              },
            },
          },
        ],
      },
      conversationEmbeddings: {
        create: [
          {
            chunkText: 'How can we implement semantic search using the pgvector embeddings?',
            chunkIndex: 0,
            // Note: In production, you would generate actual embeddings using OpenAI API
            // For seed data, we're leaving embedding null as it requires raw SQL
            metadata: {
              tokens: 10,
              model: 'text-embedding-3-small',
            },
          },
          {
            chunkText: 'To implement semantic search with pgvector, we need to generate embeddings for text chunks',
            chunkIndex: 1,
            // Embedding would be added via raw SQL in production
            metadata: {
              tokens: 14,
              model: 'text-embedding-3-small',
            },
          },
        ],
      },
    },
  })

  const conversation3 = await prisma.conversation.create({
    data: {
      sessionId: 'claude-session-789',
      projectPath: 'C:\\projects\\another-project',
      title: 'Debugging database connection issues',
      description: 'Troubleshooting PostgreSQL connection problems',
      startedAt: new Date('2025-09-28T09:00:00Z'),
      metadata: {
        environment: 'production',
        claudeModel: 'claude-3-opus',
        tags: ['debugging', 'postgresql', 'connection'],
        resolved: true,
      },
      messages: {
        create: [
          {
            role: 'system',
            content: 'System context: Production database experiencing intermittent connection timeouts',
            timestamp: new Date('2025-09-28T09:00:00Z'),
          },
          {
            role: 'user',
            content: 'The database keeps timing out. Can you help diagnose the issue?',
            timestamp: new Date('2025-09-28T09:00:05Z'),
          },
          {
            role: 'assistant',
            content: 'Let me help you diagnose the connection timeout issue. First, let me check your connection pool settings and database configuration...',
            timestamp: new Date('2025-09-28T09:00:10Z'),
            toolCalls: [
              {
                tool: 'Bash',
                parameters: {
                  command: 'pg_isready -h localhost -p 5432',
                },
              },
            ],
            toolUses: {
              create: {
                toolName: 'Bash',
                parameters: {
                  command: 'pg_isready -h localhost -p 5432',
                },
                response: {
                  stdout: 'localhost:5432 - accepting connections',
                  stderr: '',
                  exitCode: 0,
                },
                duration: 45,
                status: 'success',
                timestamp: new Date('2025-09-28T09:00:12Z'),
              },
            },
          },
        ],
      },
    },
  })

  console.log('✅ Created sample conversations:')
  console.log(`   - ${conversation1.title} (${conversation1.id})`)
  console.log(`   - ${conversation2.title} (${conversation2.id})`)
  console.log(`   - ${conversation3.title} (${conversation3.id})`)

  // Count totals
  const conversationCount = await prisma.conversation.count()
  const messageCount = await prisma.message.count()
  const toolUseCount = await prisma.toolUse.count()
  const embeddingCount = await prisma.conversationEmbedding.count()

  console.log('\n📊 Database seeded with:')
  console.log(`   - ${conversationCount} conversations`)
  console.log(`   - ${messageCount} messages`)
  console.log(`   - ${toolUseCount} tool uses`)
  console.log(`   - ${embeddingCount} conversation embeddings`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
    console.log('\n🎉 Seed completed successfully!')
  })
  .catch(async (e) => {
    console.error('❌ Error during seeding:', e)
    await prisma.$disconnect()
    process.exit(1)
  })