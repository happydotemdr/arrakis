# Metadata and Tagging System Architecture

## 📋 METADATA DESIGN FRAMEWORK

**Flexibility Strategy:**
- **Structured Labels**: Predefined categories with consistent semantics
- **Dynamic Metadata**: JSON fields for custom properties
- **Hierarchical Tags**: Support for nested label categories
- **Temporal Tracking**: When labels were added/removed and by whom

## Core Tagging Patterns

### 1. Structured Label Categories

```typescript
// Label category hierarchy
interface LabelHierarchy {
  GENERAL: {
    'epic' | 'feature' | 'bug' | 'improvement' | 'research'
  }
  TECHNOLOGY: {
    'frontend' | 'backend' | 'database' | 'infrastructure' | 'mobile'
  }
  TEAM: {
    'engineering' | 'design' | 'product' | 'marketing' | 'sales'
  }
  PRIORITY: {
    'p0-critical' | 'p1-high' | 'p2-medium' | 'p3-low'
  }
  RISK: {
    'technical-debt' | 'compliance' | 'security' | 'performance'
  }
  MILESTONE: {
    'q1-2025' | 'q2-2025' | 'mvp' | 'beta' | 'launch'
  }
  FEATURE_TYPE: {
    'customer-facing' | 'internal-tool' | 'platform' | 'integration'
  }
}

// Usage pattern for epic labeling
const epicLabels = [
  { category: 'TECHNOLOGY', name: 'frontend', color: '#3B82F6' },
  { category: 'TEAM', name: 'engineering', color: '#10B981' },
  { category: 'PRIORITY', name: 'p1-high', color: '#F59E0B' },
  { category: 'MILESTONE', name: 'q1-2025', color: '#8B5CF6' }
]
```

### 2. Dynamic Metadata System

```typescript
// Extensible metadata patterns
interface EpicMetadata {
  // Planning metadata
  planning?: {
    estimationMethod: 'story-points' | 'hours' | 't-shirt'
    confidence: 'low' | 'medium' | 'high'
    assumptions: string[]
    blockers: string[]
  }

  // Technical metadata
  technical?: {
    architecture: string[]
    dependencies: {
      internal: string[]
      external: string[]
    }
    riskFactors: string[]
    technicalDebt: boolean
  }

  // Business metadata
  business?: {
    stakeholders: string[]
    successMetrics: string[]
    userSegments: string[]
    businessCase: string
  }

  // Process metadata
  process?: {
    methodology: 'agile' | 'waterfall' | 'kanban'
    reviewProcess: string[]
    approvals: string[]
    complianceRequirements: string[]
  }

  // Custom fields (completely flexible)
  custom?: Record<string, any>
}

// Database storage pattern
model Epic {
  // ... other fields
  metadata Json? // Stores EpicMetadata as JSON

  // JSON indexes for efficient querying
  @@index(metadata, map: "idx_epic_metadata_gin", type: gin)
}
```

### 3. Label Management System

```typescript
// Label management with validation
interface LabelManagement {
  // Predefined label validation
  validateLabel(category: LabelCategory, name: string): boolean

  // Dynamic label creation with governance
  createCustomLabel(
    name: string,
    category: LabelCategory,
    color: string,
    description?: string
  ): Promise<Label>

  // Label usage analytics
  getLabelUsageStats(): Promise<LabelUsageStats>

  // Label consolidation (merge similar labels)
  consolidateLabels(sourceId: string, targetId: string): Promise<void>
}

// Label query patterns
interface LabelQueries {
  // Find epics by multiple labels (AND/OR logic)
  findEpicsByLabels(
    labels: string[],
    operator: 'AND' | 'OR'
  ): Promise<Epic[]>

  // Label co-occurrence analysis
  getLabelCorrelations(): Promise<LabelCorrelation[]>

  // Popular labels by time period
  getTrendingLabels(
    startDate: Date,
    endDate: Date
  ): Promise<LabelTrend[]>
}
```

## Advanced Metadata Patterns

### 1. Contextual Metadata

```sql
-- Epic metadata queries with PostgreSQL JSON operators
-- Find epics with specific technical dependencies
SELECT id, title, metadata
FROM epics
WHERE metadata @> '{"technical": {"dependencies": {"external": ["stripe"]}}}'
AND deleted_at IS NULL;

-- Complex business metadata filtering
SELECT e.*, COUNT(el.label_id) as label_count
FROM epics e
LEFT JOIN epic_labels el ON e.id = el.epic_id
WHERE e.metadata -> 'business' ->> 'businessCase' IS NOT NULL
AND e.metadata -> 'planning' ->> 'confidence' = 'high'
GROUP BY e.id, e.title, e.metadata
HAVING COUNT(el.label_id) >= 3;

-- Risk assessment based on metadata
SELECT
  id,
  title,
  risk,
  metadata -> 'technical' -> 'riskFactors' as technical_risks,
  metadata -> 'planning' -> 'confidence' as confidence
FROM epics
WHERE risk = 'HIGH'
OR (metadata -> 'technical' ->> 'technicalDebt')::boolean = true
ORDER BY
  CASE risk
    WHEN 'CRITICAL' THEN 1
    WHEN 'HIGH' THEN 2
    WHEN 'MEDIUM' THEN 3
    ELSE 4
  END;
```

### 2. Label Relationship Modeling

```typescript
// Advanced label relationships
interface LabelRelationship {
  id: string
  sourceLabel: Label
  targetLabel: Label
  relationshipType: 'IMPLIES' | 'EXCLUDES' | 'REQUIRES' | 'SUGGESTS'
  strength: number // 0.0 to 1.0
  createdAt: Date
}

// Example relationships
const labelRules: LabelRelationship[] = [
  {
    sourceLabel: { name: 'frontend' },
    targetLabel: { name: 'engineering' },
    relationshipType: 'IMPLIES',
    strength: 0.9
  },
  {
    sourceLabel: { name: 'p0-critical' },
    targetLabel: { name: 'p3-low' },
    relationshipType: 'EXCLUDES',
    strength: 1.0
  },
  {
    sourceLabel: { name: 'security' },
    targetLabel: { name: 'compliance' },
    relationshipType: 'SUGGESTS',
    strength: 0.7
  }
]
```

### 3. Smart Labeling Automation

```typescript
// Automated labeling based on content analysis
interface SmartLabeling {
  // AI-powered label suggestions
  suggestLabels(epic: Epic): Promise<LabelSuggestion[]>

  // Pattern-based auto-labeling
  autoLabelByPatterns(epic: Epic): Promise<Label[]>

  // Historical labeling patterns
  learnFromHistory(): Promise<LabelingModel>
}

// Implementation with vector similarity
async function suggestLabelsFromContent(epic: Epic): Promise<LabelSuggestion[]> {
  // Use existing vector search infrastructure
  const contentEmbedding = await generateEmbedding(
    `${epic.title} ${epic.description} ${epic.outcome}`
  )

  // Find similar epics and their labels
  const similarEpics = await db.$queryRaw`
    SELECT e.id, e.title, array_agg(l.name) as labels
    FROM epics e
    JOIN epic_labels el ON e.id = el.epic_id
    JOIN labels l ON el.label_id = l.id
    WHERE e.content_embedding <-> ${contentEmbedding} < 0.3
    AND e.deleted_at IS NULL
    GROUP BY e.id, e.title
    ORDER BY e.content_embedding <-> ${contentEmbedding}
    LIMIT 10
  `

  // Analyze label frequency and suggest top matches
  return analyzeLabelFrequency(similarEpics)
}
```

## Label Performance Optimization

### 1. Efficient Label Queries

```sql
-- Optimized multi-label filtering
WITH epic_label_counts AS (
  SELECT
    epic_id,
    COUNT(*) as total_labels,
    COUNT(*) FILTER (WHERE label_id = ANY($1)) as matching_labels
  FROM epic_labels el
  JOIN labels l ON el.label_id = l.id
  WHERE l.name = ANY($1::text[])
  GROUP BY epic_id
)
SELECT e.*
FROM epics e
JOIN epic_label_counts elc ON e.id = elc.epic_id
WHERE elc.matching_labels >= $2  -- minimum matching labels
AND e.deleted_at IS NULL
ORDER BY e.display_order;

-- Label usage analytics
SELECT
  l.name,
  l.category,
  COUNT(el.epic_id) as usage_count,
  COUNT(el.epic_id) * 100.0 / total_epics.count as usage_percentage
FROM labels l
LEFT JOIN epic_labels el ON l.id = el.label_id
LEFT JOIN epics e ON el.epic_id = e.id AND e.deleted_at IS NULL
CROSS JOIN (SELECT COUNT(*) as count FROM epics WHERE deleted_at IS NULL) total_epics
GROUP BY l.id, l.name, l.category, total_epics.count
ORDER BY usage_count DESC;
```

### 2. Caching Strategy

```typescript
// Label cache patterns
interface LabelCache {
  // Frequently used label combinations
  popularCombinations: Map<string, Label[]>

  // Epic label lookup cache
  epicLabels: Map<string, Label[]>

  // Label suggestion cache
  suggestions: Map<string, LabelSuggestion[]>
}

// Redis caching implementation
class LabelCacheService {
  async getEpicLabels(epicId: string): Promise<Label[]> {
    const cached = await redis.get(`epic:labels:${epicId}`)
    if (cached) return JSON.parse(cached)

    const labels = await db.label.findMany({
      where: {
        epicLabels: {
          some: { epicId }
        }
      }
    })

    await redis.setex(`epic:labels:${epicId}`, 3600, JSON.stringify(labels))
    return labels
  }

  async invalidateEpicLabels(epicId: string): Promise<void> {
    await redis.del(`epic:labels:${epicId}`)
  }
}
```

## Migration Strategy for Labels

```sql
-- Safe migration for adding label system to existing epics
BEGIN;

-- Create labels table first
CREATE TABLE labels (
  -- ... label definition
);

-- Create epic_labels junction table
CREATE TABLE epic_labels (
  -- ... junction table definition
);

-- Migrate existing epic metadata to labels
INSERT INTO labels (id, name, color, category)
VALUES
  (gen_random_uuid(), 'legacy-epic', '#6B7280', 'GENERAL'),
  (gen_random_uuid(), 'migrated', '#9CA3AF', 'GENERAL');

-- Auto-label existing epics based on patterns
WITH pattern_labels AS (
  SELECT
    e.id as epic_id,
    CASE
      WHEN e.title ILIKE '%frontend%' OR e.title ILIKE '%ui%' THEN 'frontend'
      WHEN e.title ILIKE '%backend%' OR e.title ILIKE '%api%' THEN 'backend'
      WHEN e.title ILIKE '%database%' OR e.title ILIKE '%db%' THEN 'database'
      ELSE 'general'
    END as suggested_label
  FROM epics e
  WHERE e.deleted_at IS NULL
)
INSERT INTO epic_labels (id, epic_id, label_id)
SELECT
  gen_random_uuid(),
  pl.epic_id,
  l.id
FROM pattern_labels pl
JOIN labels l ON l.name = pl.suggested_label;

COMMIT;
```

This metadata and tagging architecture provides:
- **Flexible categorization** with predefined and custom labels
- **Efficient querying** with proper indexing strategies
- **Smart automation** leveraging existing vector search capabilities
- **Performance optimization** through caching and query patterns
- **Migration safety** with backwards compatibility