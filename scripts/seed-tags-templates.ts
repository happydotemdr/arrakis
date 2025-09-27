/**
 * Seed script for conversation tags and templates
 */

import { db } from '../lib/db'
import {
  conversationTags,
  conversationTemplates,
  users,
} from '../lib/db/schema'
import { eq } from 'drizzle-orm'

async function seedTagsAndTemplates() {
  console.log('🌱 Seeding conversation tags and templates...')

  try {
    // Ensure we have a user
    let user = await db.select().from(users).where(eq(users.id, 1)).limit(1)
    if (user.length === 0) {
      console.log('Creating default user...')
      user = await db
        .insert(users)
        .values({
          username: 'default',
          settings: {},
        })
        .returning()
    }

    // Seed conversation tags
    console.log('Seeding conversation tags...')
    const tags = [
      {
        name: 'debugging',
        color: '#ef4444',
        description: 'Sessions focused on debugging and troubleshooting',
      },
      {
        name: 'development',
        color: '#10b981',
        description: 'General development and coding sessions',
      },
      {
        name: 'learning',
        color: '#3b82f6',
        description: 'Educational and learning conversations',
      },
      {
        name: 'research',
        color: '#8b5cf6',
        description: 'Research and exploration sessions',
      },
      {
        name: 'optimization',
        color: '#f59e0b',
        description: 'Performance and optimization discussions',
      },
      {
        name: 'planning',
        color: '#06b6d4',
        description: 'Project planning and architecture sessions',
      },
      {
        name: 'review',
        color: '#ec4899',
        description: 'Code review and analysis sessions',
      },
    ]

    for (const tag of tags) {
      await db.insert(conversationTags).values(tag).onConflictDoNothing()
    }

    // Seed conversation templates
    console.log('Seeding conversation templates...')
    const templates = [
      {
        name: 'Bug Report',
        description: 'Template for reporting and debugging issues',
        template: `I'm encountering an issue with {{component}}. Here are the details:

**Problem Description:**
{{description}}

**Steps to Reproduce:**
1. {{step1}}
2. {{step2}}
3. {{step3}}

**Expected Behavior:**
{{expected}}

**Actual Behavior:**
{{actual}}

**Environment:**
- OS: {{os}}
- Version: {{version}}

**Additional Context:**
{{context}}`,
        category: 'debugging',
        isPublic: true,
        userId: user[0].id,
      },
      {
        name: 'Code Review',
        description: 'Template for code review sessions',
        template: `Please review the following code:

\`\`\`{{language}}
{{code}}
\`\`\`

**Context:**
{{context}}

**Specific areas to focus on:**
- {{focus1}}
- {{focus2}}
- {{focus3}}

**Questions:**
1. {{question1}}
2. {{question2}}`,
        category: 'development',
        isPublic: true,
        userId: user[0].id,
      },
      {
        name: 'Feature Planning',
        description: 'Template for planning new features',
        template: `I want to implement a new feature: {{feature_name}}

**Purpose:**
{{purpose}}

**User Stories:**
- As a {{user_type}}, I want {{goal}} so that {{benefit}}

**Acceptance Criteria:**
- {{criteria1}}
- {{criteria2}}
- {{criteria3}}

**Technical Considerations:**
{{technical_notes}}

**Questions:**
{{questions}}`,
        category: 'planning',
        isPublic: true,
        userId: user[0].id,
      },
      {
        name: 'Performance Analysis',
        description: 'Template for performance optimization sessions',
        template: `I need help analyzing performance issues in {{component}}.

**Current Performance:**
{{current_metrics}}

**Target Performance:**
{{target_metrics}}

**Bottlenecks Identified:**
- {{bottleneck1}}
- {{bottleneck2}}

**Code/Config:**
\`\`\`{{language}}
{{code}}
\`\`\`

**Profiling Data:**
{{profiling_data}}

**Constraints:**
{{constraints}}`,
        category: 'optimization',
        isPublic: true,
        userId: user[0].id,
      },
    ]

    for (const template of templates) {
      await db
        .insert(conversationTemplates)
        .values(template)
        .onConflictDoNothing()
    }

    console.log('✅ Successfully seeded conversation tags and templates!')
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    throw error
  }
}

// Run the seeding
seedTagsAndTemplates()
  .then(() => {
    console.log('🎉 Seeding completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Seeding failed:', error)
    process.exit(1)
  })
