# Relationship Modeling for Project Collaboration

## 📊 COLLABORATION ARCHITECTURE

**Relationship Strategy:**
- **Hierarchical Projects**: Support for nested project organization
- **Epic Dependencies**: Model relationships between roadmap items
- **Flexible Permissions**: Role-based access patterns (future-ready)
- **Activity Tracking**: Comprehensive audit trail for collaboration
- **Integration Points**: Connect with existing conversation system

## Core Relationship Models

### 1. Project Hierarchy and Organization

```sql
-- Project organizational structure
CREATE TABLE projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(100) NOT NULL,
  key VARCHAR(10) UNIQUE NOT NULL, -- Short identifier like "WEB", "API"
  description TEXT,
  color CHAR(7), -- Visual identification
  status project_status DEFAULT 'ACTIVE',

  -- Hierarchical structure
  parent_project_id TEXT REFERENCES projects(id),
  display_order DECIMAL(20,10) DEFAULT 1000,
  depth INTEGER DEFAULT 0, -- Calculated depth for queries

  -- Project lifecycle
  start_date DATE,
  end_date DATE,
  budget DECIMAL(12,2), -- Optional budget tracking

  -- Team assignment (future extension)
  owner_id TEXT, -- Project lead
  team_ids TEXT[], -- Team member IDs

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by TEXT,
  last_modified_by TEXT
);

-- Project membership and roles (future collaboration)
CREATE TABLE project_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Future: reference to users table
  role project_role DEFAULT 'MEMBER',
  permissions TEXT[], -- Array of permission strings

  -- Membership lifecycle
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  invited_by TEXT,

  UNIQUE(project_id, user_id, left_at) -- Allow rejoining
);

CREATE TYPE project_role AS ENUM (
  'OWNER',       -- Full control
  'ADMIN',       -- Manage epics and members
  'CONTRIBUTOR', -- Create/edit epics
  'VIEWER'       -- Read-only access
);

-- Indexes for project hierarchy navigation
CREATE INDEX idx_project_parent_child ON projects (parent_project_id, display_order);
CREATE INDEX idx_project_hierarchy_path ON projects (depth, parent_project_id);
CREATE INDEX idx_project_members_project ON project_members (project_id, role);
CREATE INDEX idx_project_members_user ON project_members (user_id, left_at);
```

### 2. Epic Relationships and Dependencies

```sql
-- Epic dependency modeling
CREATE TABLE epic_dependencies (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  target_epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  dependency_type dependency_type NOT NULL,
  strength INTEGER DEFAULT 5, -- 1-10 scale of dependency strength
  description TEXT, -- Why this dependency exists

  -- Lifecycle tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ, -- When dependency was resolved
  created_by TEXT,

  -- Prevent circular dependencies and self-reference
  CONSTRAINT no_self_dependency CHECK (source_epic_id != target_epic_id),
  UNIQUE(source_epic_id, target_epic_id, dependency_type)
);

CREATE TYPE dependency_type AS ENUM (
  'BLOCKS',        -- Source blocks target
  'BLOCKED_BY',    -- Source is blocked by target
  'DEPENDS_ON',    -- Source depends on target completion
  'ENABLES',       -- Source enables target to start
  'RELATED',       -- Loose relationship
  'CHILD_OF',      -- Hierarchical parent-child
  'DUPLICATES'     -- Duplicate work identification
);

-- Epic-to-epic relationships with metadata
CREATE TABLE epic_relationships (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  target_epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  relationship_type epic_relationship_type NOT NULL,
  bidirectional BOOLEAN DEFAULT false, -- If relationship applies both ways
  metadata JSONB, -- Additional relationship context

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,

  UNIQUE(source_epic_id, target_epic_id, relationship_type)
);

CREATE TYPE epic_relationship_type AS ENUM (
  'SIMILAR',       -- Similar functionality or approach
  'ALTERNATIVE',   -- Alternative implementation approaches
  'SUCCESSOR',     -- Follows from previous epic
  'MERGED_FROM',   -- Result of merging multiple epics
  'SPLIT_FROM',    -- Split off from larger epic
  'INSPIRED_BY'    -- Inspired by or based on
);

-- Indexes for relationship queries
CREATE INDEX idx_epic_deps_source ON epic_dependencies (source_epic_id, dependency_type);
CREATE INDEX idx_epic_deps_target ON epic_dependencies (target_epic_id, dependency_type);
CREATE INDEX idx_epic_deps_type ON epic_dependencies (dependency_type, resolved_at);
CREATE INDEX idx_epic_relationships_source ON epic_relationships (source_epic_id, relationship_type);
CREATE INDEX idx_epic_relationships_target ON epic_relationships (target_epic_id, relationship_type);
```

### 3. Conversation Integration

```sql
-- Link epics to conversations (leverage existing schema)
CREATE TABLE epic_conversations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  link_type conversation_link_type DEFAULT 'DISCUSSION',
  context TEXT, -- Why this conversation is linked

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,

  UNIQUE(epic_id, conversation_id)
);

CREATE TYPE conversation_link_type AS ENUM (
  'DISCUSSION',    -- General discussion about epic
  'PLANNING',      -- Planning session for epic
  'REVIEW',        -- Review or retrospective
  'DECISION',      -- Decision making conversation
  'IMPLEMENTATION' -- Implementation discussion
);

-- Epic mention extraction from conversations
CREATE TABLE epic_mentions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  mention_type mention_type DEFAULT 'REFERENCE',
  context_snippet TEXT, -- Surrounding text for context
  confidence DECIMAL(3,2), -- AI confidence in mention (0.0-1.0)

  detected_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ, -- Manual verification timestamp
  verified_by TEXT,

  UNIQUE(epic_id, message_id)
);

CREATE TYPE mention_type AS ENUM (
  'REFERENCE',     -- General reference to epic
  'STATUS_UPDATE', -- Status change discussion
  'BLOCKER',       -- Epic is mentioned as blocked
  'COMPLETION',    -- Epic completion discussion
  'QUESTION'       -- Question about epic
);

-- Indexes for conversation integration
CREATE INDEX idx_epic_conversations_epic ON epic_conversations (epic_id, link_type);
CREATE INDEX idx_epic_conversations_conv ON epic_conversations (conversation_id, link_type);
CREATE INDEX idx_epic_mentions_epic ON epic_mentions (epic_id, mention_type);
CREATE INDEX idx_epic_mentions_message ON epic_mentions (message_id, confidence);
```

## Advanced Collaboration Patterns

### 1. Epic Workflow States

```sql
-- Workflow state transitions
CREATE TABLE epic_workflow_states (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  from_status epic_status,
  to_status epic_status NOT NULL,
  transition_reason TEXT,
  required_approvals TEXT[], -- Array of required approval types
  actual_approvals TEXT[], -- Array of received approvals

  -- Transition metadata
  transitioned_at TIMESTAMPTZ DEFAULT NOW(),
  transitioned_by TEXT,
  auto_transition BOOLEAN DEFAULT false, -- If automated vs manual

  -- Workflow context
  workflow_step INTEGER, -- Position in overall workflow
  estimated_duration INTERVAL, -- How long epic should spend in this state
  actual_duration INTERVAL -- How long epic actually spent (calculated)
);

-- Epic approvals system
CREATE TABLE epic_approvals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  approval_type approval_type NOT NULL,
  required_for_status epic_status, -- Status this approval enables

  -- Approval details
  approver_id TEXT, -- Who can/should approve
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  rejection_reason TEXT,
  approval_criteria TEXT, -- What needs to be checked

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Approval expiration

  UNIQUE(epic_id, approval_type, required_for_status)
);

CREATE TYPE approval_type AS ENUM (
  'TECHNICAL_REVIEW',
  'BUSINESS_APPROVAL',
  'SECURITY_REVIEW',
  'DESIGN_REVIEW',
  'STAKEHOLDER_SIGN_OFF',
  'BUDGET_APPROVAL',
  'COMPLIANCE_CHECK'
);

-- Indexes for workflow management
CREATE INDEX idx_epic_workflow_epic ON epic_workflow_states (epic_id, transitioned_at);
CREATE INDEX idx_epic_workflow_status ON epic_workflow_states (to_status, transitioned_at);
CREATE INDEX idx_epic_approvals_epic ON epic_approvals (epic_id, approval_type);
CREATE INDEX idx_epic_approvals_pending ON epic_approvals (required_for_status, approved_at)
  WHERE approved_at IS NULL AND expires_at > NOW();
```

### 2. Collaboration Activity Tracking

```sql
-- Comprehensive activity tracking
CREATE TABLE epic_activities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  epic_id TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  activity_type activity_type NOT NULL,
  actor_id TEXT, -- Who performed the activity
  actor_type actor_type DEFAULT 'USER',

  -- Activity details
  summary TEXT NOT NULL, -- Human readable summary
  details JSONB, -- Structured activity details
  entity_id TEXT, -- Related entity (comment_id, attachment_id, etc.)
  entity_type TEXT, -- Type of related entity

  -- Change tracking
  field_changes JSONB, -- Before/after values for field changes
  impact_score INTEGER DEFAULT 1, -- 1-10 scale of activity importance

  -- Metadata
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET, -- For audit trail
  user_agent TEXT, -- Browser/client info
  session_id TEXT -- Link to session if available
);

CREATE TYPE activity_type AS ENUM (
  'CREATED',
  'UPDATED',
  'STATUS_CHANGED',
  'REORDERED',
  'LABELED',
  'UNLABELED',
  'COMMENTED',
  'ATTACHED_FILE',
  'REMOVED_FILE',
  'DEPENDENCY_ADDED',
  'DEPENDENCY_REMOVED',
  'APPROVED',
  'REJECTED',
  'MENTIONED',
  'LINKED_CONVERSATION'
);

CREATE TYPE actor_type AS ENUM (
  'USER',          -- Human user
  'SYSTEM',        -- Automated system action
  'INTEGRATION',   -- External system integration
  'AI_ASSISTANT'   -- AI-generated action
);

-- Activity aggregation for performance
CREATE MATERIALIZED VIEW epic_activity_summary AS
SELECT
  epic_id,
  COUNT(*) as total_activities,
  COUNT(DISTINCT actor_id) as unique_contributors,
  MAX(occurred_at) as last_activity_at,
  COUNT(*) FILTER (WHERE activity_type = 'COMMENTED') as comment_count,
  COUNT(*) FILTER (WHERE activity_type = 'STATUS_CHANGED') as status_changes,
  COUNT(*) FILTER (WHERE activity_type = 'UPDATED') as edit_count,
  AVG(impact_score) as avg_impact_score
FROM epic_activities
WHERE occurred_at > NOW() - INTERVAL '90 days' -- Recent activity only
GROUP BY epic_id;

-- Indexes for activity queries
CREATE INDEX idx_epic_activities_epic_time ON epic_activities (epic_id, occurred_at DESC);
CREATE INDEX idx_epic_activities_actor ON epic_activities (actor_id, occurred_at DESC);
CREATE INDEX idx_epic_activities_type ON epic_activities (activity_type, occurred_at DESC);
CREATE INDEX idx_epic_activities_impact ON epic_activities (impact_score DESC, occurred_at DESC);
```

## Collaboration Query Patterns

### 1. Dependency Analysis Queries

```sql
-- Find all blocking relationships for an epic
WITH RECURSIVE epic_blockers AS (
  -- Direct blockers
  SELECT
    ed.source_epic_id as blocker_id,
    ed.target_epic_id as blocked_id,
    e.title as blocker_title,
    e.status as blocker_status,
    1 as depth
  FROM epic_dependencies ed
  JOIN epics e ON ed.source_epic_id = e.id
  WHERE ed.target_epic_id = $1 -- Input epic ID
    AND ed.dependency_type = 'BLOCKS'
    AND ed.resolved_at IS NULL

  UNION ALL

  -- Transitive blockers
  SELECT
    ed.source_epic_id,
    eb.blocked_id,
    e.title,
    e.status,
    eb.depth + 1
  FROM epic_dependencies ed
  JOIN epic_blockers eb ON ed.target_epic_id = eb.blocker_id
  JOIN epics e ON ed.source_epic_id = e.id
  WHERE ed.dependency_type = 'BLOCKS'
    AND ed.resolved_at IS NULL
    AND eb.depth < 5 -- Prevent infinite recursion
)
SELECT * FROM epic_blockers ORDER BY depth, blocker_title;

-- Critical path analysis
WITH epic_paths AS (
  SELECT
    source_epic_id,
    target_epic_id,
    array[source_epic_id, target_epic_id] as path,
    2 as path_length
  FROM epic_dependencies
  WHERE dependency_type = 'DEPENDS_ON'
    AND resolved_at IS NULL

  UNION ALL

  SELECT
    ep.source_epic_id,
    ed.target_epic_id,
    ep.path || ed.target_epic_id,
    ep.path_length + 1
  FROM epic_paths ep
  JOIN epic_dependencies ed ON ep.target_epic_id = ed.source_epic_id
  WHERE ed.dependency_type = 'DEPENDS_ON'
    AND ed.resolved_at IS NULL
    AND NOT ed.target_epic_id = ANY(ep.path) -- Prevent cycles
    AND ep.path_length < 10
)
SELECT
  path,
  path_length,
  string_agg(e.title, ' → ' ORDER BY array_position(path, e.id)) as path_titles
FROM epic_paths ep
CROSS JOIN unnest(ep.path) as epic_id
JOIN epics e ON e.id = epic_id
GROUP BY path, path_length
ORDER BY path_length DESC;
```

### 2. Collaboration Metrics

```sql
-- Epic collaboration health metrics
SELECT
  e.id,
  e.title,
  e.status,
  eas.unique_contributors,
  eas.total_activities,
  eas.last_activity_at,
  CASE
    WHEN eas.last_activity_at > NOW() - INTERVAL '7 days' THEN 'Active'
    WHEN eas.last_activity_at > NOW() - INTERVAL '30 days' THEN 'Moderate'
    ELSE 'Stale'
  END as activity_level,
  COALESCE(blocking_count, 0) as blocking_others_count,
  COALESCE(blocked_count, 0) as blocked_by_count
FROM epics e
LEFT JOIN epic_activity_summary eas ON e.id = eas.epic_id
LEFT JOIN (
  SELECT target_epic_id, COUNT(*) as blocking_count
  FROM epic_dependencies
  WHERE dependency_type = 'BLOCKS' AND resolved_at IS NULL
  GROUP BY target_epic_id
) blocking ON e.id = blocking.target_epic_id
LEFT JOIN (
  SELECT source_epic_id, COUNT(*) as blocked_count
  FROM epic_dependencies
  WHERE dependency_type = 'BLOCKS' AND resolved_at IS NULL
  GROUP BY source_epic_id
) blocked ON e.id = blocked.source_epic_id
WHERE e.deleted_at IS NULL
ORDER BY eas.avg_impact_score DESC NULLS LAST;

-- Project collaboration overview
SELECT
  p.name as project_name,
  COUNT(e.id) as total_epics,
  COUNT(e.id) FILTER (WHERE e.status = 'IN_PROGRESS') as active_epics,
  COUNT(DISTINCT eas.unique_contributors) as total_contributors,
  AVG(eas.total_activities) as avg_activities_per_epic,
  MAX(eas.last_activity_at) as last_project_activity
FROM projects p
LEFT JOIN epics e ON p.id = e.project_id AND e.deleted_at IS NULL
LEFT JOIN epic_activity_summary eas ON e.id = eas.epic_id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name
ORDER BY total_contributors DESC;
```

### 3. Integration with Conversation System

```sql
-- Epic discussions from conversation analysis
SELECT
  e.id as epic_id,
  e.title,
  c.title as conversation_title,
  ec.link_type,
  COUNT(m.id) as message_count,
  COUNT(DISTINCT m.role) as participant_types,
  MAX(m.timestamp) as last_discussion_at,
  -- Extract key discussion topics using existing vector search
  array_agg(DISTINCT
    substring(m.content FROM 1 FOR 100)
    ORDER BY m.timestamp DESC
  ) as recent_excerpts
FROM epics e
JOIN epic_conversations ec ON e.id = ec.epic_id
JOIN conversations c ON ec.conversation_id = c.id
JOIN messages m ON c.id = m.conversation_id
WHERE e.deleted_at IS NULL
  AND c.ended_at IS NULL -- Active conversations
GROUP BY e.id, e.title, c.id, c.title, ec.link_type
ORDER BY last_discussion_at DESC;

-- AI-powered epic mention detection
SELECT
  e.id as epic_id,
  e.title,
  em.mention_type,
  em.context_snippet,
  em.confidence,
  m.content as full_message,
  m.timestamp,
  c.title as conversation_title
FROM epic_mentions em
JOIN epics e ON em.epic_id = e.id
JOIN messages m ON em.message_id = m.id
JOIN conversations c ON m.conversation_id = c.id
WHERE em.confidence > 0.7 -- High confidence mentions only
  AND em.verified_at IS NULL -- Unverified mentions
  AND e.status IN ('PLANNED', 'IN_PROGRESS') -- Active epics only
ORDER BY em.confidence DESC, m.timestamp DESC;
```

This collaboration relationship model provides:
- **Hierarchical project organization** with team management
- **Complex dependency tracking** with cycle detection
- **Comprehensive activity logging** for transparency
- **Integration with existing conversation system**
- **Workflow state management** with approval processes
- **Performance-optimized queries** for collaboration insights