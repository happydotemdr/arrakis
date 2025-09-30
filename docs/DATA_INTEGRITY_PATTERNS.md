# Data Integrity and Consistency Patterns

## 🛡️ DATA INTEGRITY FRAMEWORK

**Integrity Strategy:**
- **Multi-Level Validation**: Database constraints + application logic + API validation
- **Optimistic Locking**: Prevent lost updates in concurrent scenarios
- **Referential Integrity**: Foreign key constraints with proper cascade rules
- **Business Rule Enforcement**: Database triggers + application business logic
- **Audit Trail Completeness**: Comprehensive change tracking

## Core Integrity Patterns

### 1. Optimistic Locking Implementation

```sql
-- Epic version-based optimistic locking
CREATE OR REPLACE FUNCTION epic_optimistic_update(
  p_epic_id TEXT,
  p_expected_version INTEGER,
  p_updates JSONB
) RETURNS TABLE(
  id TEXT,
  title TEXT,
  status epic_status,
  version INTEGER,
  updated_at TIMESTAMPTZ
) LANGUAGE plpgsql AS $$
DECLARE
  v_current_version INTEGER;
  v_result RECORD;
BEGIN
  -- Lock and check current version
  SELECT version INTO v_current_version
  FROM epics
  WHERE id = p_epic_id AND deleted_at IS NULL
  FOR UPDATE;

  -- Version mismatch check
  IF v_current_version IS NULL THEN
    RAISE EXCEPTION 'Epic not found or deleted' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_current_version != p_expected_version THEN
    RAISE EXCEPTION 'Concurrent modification detected. Expected version %, found %',
      p_expected_version, v_current_version
      USING ERRCODE = 'serialization_failure';
  END IF;

  -- Apply updates with version increment
  UPDATE epics
  SET
    title = COALESCE((p_updates->>'title')::TEXT, title),
    description = CASE
      WHEN p_updates ? 'description' THEN (p_updates->>'description')::TEXT
      ELSE description
    END,
    status = COALESCE((p_updates->>'status')::epic_status, status),
    priority = COALESCE((p_updates->>'priority')::priority, priority),
    effort = CASE
      WHEN p_updates ? 'effort' THEN (p_updates->>'effort')::INTEGER
      ELSE effort
    END,
    business_value = CASE
      WHEN p_updates ? 'businessValue' THEN (p_updates->>'businessValue')::INTEGER
      ELSE business_value
    END,
    version = version + 1,
    updated_at = NOW(),
    last_modified_by = p_updates->>'lastModifiedBy'
  WHERE id = p_epic_id
  RETURNING * INTO v_result;

  RETURN QUERY SELECT
    v_result.id,
    v_result.title,
    v_result.status,
    v_result.version,
    v_result.updated_at;
END;
$$;

-- TypeScript implementation
interface OptimisticUpdateResult<T> {
  success: boolean
  data?: T
  error?: 'NOT_FOUND' | 'VERSION_CONFLICT' | 'VALIDATION_ERROR'
  currentVersion?: number
}

async function updateEpicOptimistic(
  id: string,
  expectedVersion: number,
  updates: Partial<Epic>
): Promise<OptimisticUpdateResult<Epic>> {
  try {
    const result = await db.$queryRaw`
      SELECT * FROM epic_optimistic_update(
        ${id},
        ${expectedVersion},
        ${JSON.stringify(updates)}
      )
    `

    return {
      success: true,
      data: result[0] as Epic
    }
  } catch (error) {
    if (error.code === 'P0001' && error.message.includes('Concurrent modification')) {
      // Fetch current version for client retry
      const currentEpic = await db.epic.findUnique({
        where: { id },
        select: { version: true }
      })

      return {
        success: false,
        error: 'VERSION_CONFLICT',
        currentVersion: currentEpic?.version
      }
    }

    return {
      success: false,
      error: 'VALIDATION_ERROR'
    }
  }
}
```

### 2. Referential Integrity with Smart Cascades

```sql
-- Comprehensive foreign key constraints with smart cascade behavior
-- Epic to Project relationship
ALTER TABLE epics
ADD CONSTRAINT fk_epic_project
FOREIGN KEY (project_id) REFERENCES projects(id)
ON DELETE SET NULL  -- Keep epic if project deleted
ON UPDATE CASCADE;

-- Epic hierarchy constraint
ALTER TABLE epics
ADD CONSTRAINT fk_epic_parent
FOREIGN KEY (parent_epic_id) REFERENCES epics(id)
ON DELETE SET NULL  -- Orphan children if parent deleted
ON UPDATE CASCADE;

-- Epic labels junction table
ALTER TABLE epic_labels
ADD CONSTRAINT fk_epic_label_epic
FOREIGN KEY (epic_id) REFERENCES epics(id)
ON DELETE CASCADE   -- Remove labels if epic deleted
ON UPDATE CASCADE;

ALTER TABLE epic_labels
ADD CONSTRAINT fk_epic_label_label
FOREIGN KEY (label_id) REFERENCES labels(id)
ON DELETE CASCADE   -- Remove epic association if label deleted
ON UPDATE CASCADE;

-- Epic dependencies with integrity checks
ALTER TABLE epic_dependencies
ADD CONSTRAINT fk_epic_dep_source
FOREIGN KEY (source_epic_id) REFERENCES epics(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE epic_dependencies
ADD CONSTRAINT fk_epic_dep_target
FOREIGN KEY (target_epic_id) REFERENCES epics(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Prevent circular dependencies
CREATE OR REPLACE FUNCTION check_epic_dependency_cycle()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for immediate circular dependency
  IF EXISTS (
    SELECT 1 FROM epic_dependencies
    WHERE source_epic_id = NEW.target_epic_id
      AND target_epic_id = NEW.source_epic_id
      AND dependency_type = NEW.dependency_type
  ) THEN
    RAISE EXCEPTION 'Circular dependency detected between epics % and %',
      NEW.source_epic_id, NEW.target_epic_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Check for transitive circular dependencies (up to 10 levels deep)
  IF EXISTS (
    WITH RECURSIVE dep_path AS (
      SELECT source_epic_id, target_epic_id, 1 as depth,
             ARRAY[source_epic_id] as path
      FROM epic_dependencies
      WHERE source_epic_id = NEW.target_epic_id
        AND dependency_type = NEW.dependency_type

      UNION ALL

      SELECT ed.source_epic_id, ed.target_epic_id, dp.depth + 1,
             dp.path || ed.source_epic_id
      FROM epic_dependencies ed
      JOIN dep_path dp ON ed.source_epic_id = dp.target_epic_id
      WHERE dp.depth < 10
        AND ed.dependency_type = NEW.dependency_type
        AND NOT ed.source_epic_id = ANY(dp.path)
    )
    SELECT 1 FROM dep_path WHERE target_epic_id = NEW.source_epic_id
  ) THEN
    RAISE EXCEPTION 'Transitive circular dependency detected'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_dependency_cycle
  BEFORE INSERT OR UPDATE ON epic_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION check_epic_dependency_cycle();
```

### 3. Business Rule Enforcement

```sql
-- Epic business rule constraints
ALTER TABLE epics
ADD CONSTRAINT check_epic_title_length
CHECK (LENGTH(TRIM(title)) >= 3 AND LENGTH(title) <= 200);

ALTER TABLE epics
ADD CONSTRAINT check_epic_business_value_range
CHECK (business_value IS NULL OR (business_value >= 1 AND business_value <= 10));

ALTER TABLE epics
ADD CONSTRAINT check_epic_effort_positive
CHECK (effort IS NULL OR effort > 0);

ALTER TABLE epics
ADD CONSTRAINT check_epic_quarter_format
CHECK (quarter IS NULL OR quarter ~ '^Q[1-4]\s20\d{2}$');

ALTER TABLE epics
ADD CONSTRAINT check_epic_color_format
CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$');

-- Date consistency constraints
ALTER TABLE epics
ADD CONSTRAINT check_epic_date_logic
CHECK (
  (start_date IS NULL OR target_date IS NULL OR start_date <= target_date) AND
  (completed_date IS NULL OR target_date IS NULL OR
   (status = 'COMPLETED' AND completed_date IS NOT NULL))
);

-- Status transition validation
CREATE OR REPLACE FUNCTION validate_epic_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions TEXT[][];
BEGIN
  -- Define valid status transitions
  valid_transitions := ARRAY[
    ['PLANNED', 'IN_PROGRESS'],
    ['PLANNED', 'CANCELLED'],
    ['PLANNED', 'ON_HOLD'],
    ['IN_PROGRESS', 'BLOCKED'],
    ['IN_PROGRESS', 'REVIEW'],
    ['IN_PROGRESS', 'COMPLETED'],
    ['IN_PROGRESS', 'CANCELLED'],
    ['IN_PROGRESS', 'ON_HOLD'],
    ['BLOCKED', 'IN_PROGRESS'],
    ['BLOCKED', 'CANCELLED'],
    ['REVIEW', 'IN_PROGRESS'],
    ['REVIEW', 'COMPLETED'],
    ['REVIEW', 'CANCELLED'],
    ['ON_HOLD', 'PLANNED'],
    ['ON_HOLD', 'IN_PROGRESS'],
    ['ON_HOLD', 'CANCELLED']
  ];

  -- Allow any transition for new records
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Check if status actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Validate transition
  IF NOT ARRAY[OLD.status::TEXT, NEW.status::TEXT] = ANY(valid_transitions) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %',
      OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Set completed_date when transitioning to COMPLETED
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    NEW.completed_date := CURRENT_DATE;
  END IF;

  -- Clear completed_date when transitioning away from COMPLETED
  IF NEW.status != 'COMPLETED' AND OLD.status = 'COMPLETED' THEN
    NEW.completed_date := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER epic_status_transition_validation
  BEFORE UPDATE ON epics
  FOR EACH ROW
  EXECUTE FUNCTION validate_epic_status_transition();
```

### 4. Comprehensive Audit Trail

```sql
-- Audit trigger for comprehensive change tracking
CREATE OR REPLACE FUNCTION epic_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  old_values JSONB;
  new_values JSONB;
  changed_fields TEXT[];
  field_name TEXT;
BEGIN
  -- Determine operation type
  IF TG_OP = 'INSERT' THEN
    -- Record creation
    INSERT INTO epic_history (
      epic_id, field, old_value, new_value, change_type, changed_by
    ) VALUES (
      NEW.id, 'record', NULL, 'Epic created', 'CREATED', NEW.created_by
    );

    -- Record initial field values
    FOR field_name IN SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'epics'
        AND column_name NOT IN ('id', 'created_at', 'updated_at', 'version')
    LOOP
      EXECUTE format('
        INSERT INTO epic_history (epic_id, field, old_value, new_value, change_type, changed_by)
        VALUES ($1, $2, NULL, ($3).%I::TEXT, ''CREATED'', $4)
      ', field_name) USING NEW.id, field_name, NEW, NEW.created_by;
    END LOOP;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Build JSON representations for comparison
    old_values := to_jsonb(OLD);
    new_values := to_jsonb(NEW);

    -- Find changed fields
    SELECT array_agg(key) INTO changed_fields
    FROM jsonb_each_text(old_values) o(key, old_val)
    JOIN jsonb_each_text(new_values) n(key, new_val) ON o.key = n.key
    WHERE o.old_val IS DISTINCT FROM n.new_val
      AND o.key NOT IN ('updated_at', 'version', 'last_modified_by');

    -- Record field-level changes
    IF array_length(changed_fields, 1) > 0 THEN
      FOREACH field_name IN ARRAY changed_fields
      LOOP
        INSERT INTO epic_history (
          epic_id, field, old_value, new_value, change_type, changed_by
        ) VALUES (
          NEW.id,
          field_name,
          old_values->>field_name,
          new_values->>field_name,
          CASE
            WHEN field_name = 'status' THEN 'STATUS_CHANGED'
            WHEN field_name = 'display_order' THEN 'REORDERED'
            ELSE 'UPDATED'
          END,
          NEW.last_modified_by
        );
      END LOOP;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Record soft deletion
    INSERT INTO epic_history (
      epic_id, field, old_value, new_value, change_type, changed_by
    ) VALUES (
      OLD.id, 'deleted_at', NULL, OLD.deleted_at::TEXT, 'DELETED', OLD.last_modified_by
    );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER epic_audit_trail
  AFTER INSERT OR UPDATE OR DELETE ON epics
  FOR EACH ROW
  EXECUTE FUNCTION epic_audit_trigger();
```

### 5. Data Validation Layers

```typescript
// Multi-layer validation strategy
import { z } from 'zod'

// 1. API Layer Validation (tRPC input schemas)
const EpicCreateSchema = z.object({
  title: z.string().min(3).max(200).trim(),
  description: z.string().max(10000).optional(),
  status: z.nativeEnum(EpicStatus).default('PLANNED'),
  priority: z.nativeEnum(Priority).default('MEDIUM'),
  quarter: z.string().regex(/^Q[1-4]\s20\d{2}$/).optional(),
  businessValue: z.number().int().min(1).max(10).optional(),
  effort: z.number().int().positive().optional(),
  projectId: z.string().uuid().optional(),
  parentEpicId: z.string().uuid().optional()
})

const EpicUpdateSchema = EpicCreateSchema.partial().extend({
  id: z.string().uuid(),
  version: z.number().int().positive() // Required for optimistic locking
})

// 2. Business Logic Validation
class EpicBusinessRules {
  static async validateEpicCreation(data: EpicCreateInput): Promise<ValidationResult> {
    const errors: string[] = []

    // Project existence validation
    if (data.projectId) {
      const project = await db.project.findFirst({
        where: { id: data.projectId, deletedAt: null }
      })
      if (!project) {
        errors.push('Referenced project does not exist')
      }
    }

    // Parent epic validation
    if (data.parentEpicId) {
      const parent = await db.epic.findFirst({
        where: { id: data.parentEpicId, deletedAt: null }
      })
      if (!parent) {
        errors.push('Referenced parent epic does not exist')
      }
      // Prevent excessive nesting
      const depth = await this.calculateEpicDepth(data.parentEpicId)
      if (depth >= 5) {
        errors.push('Epic hierarchy too deep (maximum 5 levels)')
      }
    }

    // Business value vs effort validation
    if (data.businessValue && data.effort) {
      if (data.businessValue < 3 && data.effort > 20) {
        errors.push('Low business value epics should not require high effort')
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  private static async calculateEpicDepth(epicId: string): Promise<number> {
    const result = await db.$queryRaw<Array<{depth: number}>>`
      WITH RECURSIVE epic_hierarchy AS (
        SELECT id, parent_epic_id, 0 as depth
        FROM epics
        WHERE id = ${epicId}

        UNION ALL

        SELECT e.id, e.parent_epic_id, eh.depth + 1
        FROM epics e
        JOIN epic_hierarchy eh ON e.id = eh.parent_epic_id
        WHERE eh.depth < 10
      )
      SELECT MAX(depth) as depth FROM epic_hierarchy
    `

    return result[0]?.depth || 0
  }
}

// 3. Database Transaction Wrapper with Validation
async function createEpicWithValidation(
  data: EpicCreateInput,
  userId?: string
): Promise<Epic> {
  return db.$transaction(async (tx) => {
    // Pre-transaction validation
    const validation = await EpicBusinessRules.validateEpicCreation(data)
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
    }

    // Calculate display order
    const maxOrder = await tx.epic.findFirst({
      where: {
        projectId: data.projectId || null,
        parentEpicId: data.parentEpicId || null,
        deletedAt: null
      },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    })

    const displayOrder = maxOrder
      ? maxOrder.displayOrder.add(1000)
      : new Decimal(1000)

    // Create epic
    const epic = await tx.epic.create({
      data: {
        ...data,
        displayOrder,
        createdBy: userId,
        lastModifiedBy: userId
      }
    })

    // Post-creation tasks
    await tx.epicActivity.create({
      data: {
        epicId: epic.id,
        activityType: 'CREATED',
        summary: `Epic "${epic.title}" was created`,
        actorId: userId,
        actorType: 'USER'
      }
    })

    return epic
  }, {
    timeout: 10000,
    isolationLevel: 'ReadCommitted'
  })
}
```

### 6. Consistency Maintenance

```sql
-- Consistency maintenance functions
CREATE OR REPLACE FUNCTION maintain_epic_consistency()
RETURNS void AS $$
BEGIN
  -- Fix orphaned epics (parent doesn't exist)
  UPDATE epics
  SET parent_epic_id = NULL
  WHERE parent_epic_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM epics p
      WHERE p.id = epics.parent_epic_id
        AND p.deleted_at IS NULL
    );

  -- Remove dependencies to deleted epics
  DELETE FROM epic_dependencies
  WHERE NOT EXISTS (
    SELECT 1 FROM epics e
    WHERE e.id = epic_dependencies.source_epic_id
      AND e.deleted_at IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM epics e
    WHERE e.id = epic_dependencies.target_epic_id
      AND e.deleted_at IS NULL
  );

  -- Remove labels for deleted epics
  DELETE FROM epic_labels
  WHERE NOT EXISTS (
    SELECT 1 FROM epics e
    WHERE e.id = epic_labels.epic_id
      AND e.deleted_at IS NULL
  );

  -- Normalize display orders within projects
  WITH ordered_epics AS (
    SELECT
      id,
      project_id,
      parent_epic_id,
      ROW_NUMBER() OVER (
        PARTITION BY project_id, parent_epic_id
        ORDER BY display_order, created_at
      ) * 1000 as new_order
    FROM epics
    WHERE deleted_at IS NULL
  )
  UPDATE epics
  SET display_order = oe.new_order
  FROM ordered_epics oe
  WHERE epics.id = oe.id
    AND epics.display_order != oe.new_order;

  -- Log maintenance completion
  INSERT INTO system_events (event_type, details, occurred_at)
  VALUES ('consistency_maintenance', '{"operation": "epic_consistency_check"}', NOW());
END;
$$ LANGUAGE plpgsql;

-- Schedule consistency maintenance
SELECT cron.schedule(
  'epic-consistency-maintenance',
  '0 3 * * 0', -- Weekly on Sunday at 3 AM
  'SELECT maintain_epic_consistency();'
);
```

### 7. Recovery and Rollback Procedures

```sql
-- Epic recovery functions
CREATE OR REPLACE FUNCTION recover_epic(
  p_epic_id TEXT,
  p_recovery_user TEXT DEFAULT 'system'
) RETURNS boolean AS $$
DECLARE
  epic_exists boolean;
BEGIN
  -- Check if epic exists and is deleted
  SELECT EXISTS (
    SELECT 1 FROM epics
    WHERE id = p_epic_id AND deleted_at IS NOT NULL
  ) INTO epic_exists;

  IF NOT epic_exists THEN
    RAISE EXCEPTION 'Epic not found or not deleted' USING ERRCODE = 'no_data_found';
  END IF;

  -- Restore epic
  UPDATE epics
  SET
    deleted_at = NULL,
    version = version + 1,
    updated_at = NOW(),
    last_modified_by = p_recovery_user
  WHERE id = p_epic_id;

  -- Record recovery in audit log
  INSERT INTO epic_history (
    epic_id, field, old_value, new_value, change_type, changed_by
  ) VALUES (
    p_epic_id, 'deleted_at', 'deleted', NULL, 'RESTORED', p_recovery_user
  );

  -- Log activity
  INSERT INTO epic_activities (
    epic_id, activity_type, summary, actor_id, actor_type
  ) VALUES (
    p_epic_id, 'RESTORED', 'Epic was recovered from deletion', p_recovery_user, 'USER'
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Point-in-time recovery for epic state
CREATE OR REPLACE FUNCTION restore_epic_to_timestamp(
  p_epic_id TEXT,
  p_restore_time TIMESTAMPTZ,
  p_user_id TEXT DEFAULT 'system'
) RETURNS boolean AS $$
DECLARE
  field_record RECORD;
  restore_data JSONB := '{}';
BEGIN
  -- Build restore data from history
  FOR field_record IN
    SELECT DISTINCT ON (field) field, old_value
    FROM epic_history
    WHERE epic_id = p_epic_id
      AND changed_at <= p_restore_time
    ORDER BY field, changed_at DESC
  LOOP
    restore_data := restore_data || jsonb_build_object(field_record.field, field_record.old_value);
  END LOOP;

  -- Apply restoration (this would need to be expanded based on specific fields)
  -- This is a simplified example
  UPDATE epics
  SET
    version = version + 1,
    updated_at = NOW(),
    last_modified_by = p_user_id
  WHERE id = p_epic_id;

  -- Record restoration in audit log
  INSERT INTO epic_history (
    epic_id, field, old_value, new_value, change_type, changed_by
  ) VALUES (
    p_epic_id, 'point_in_time_restore', NULL,
    'Restored to ' || p_restore_time::TEXT, 'RESTORED', p_user_id
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql;
```

This data integrity framework provides:
- **Optimistic locking** to prevent lost updates
- **Comprehensive constraint validation** at multiple layers
- **Business rule enforcement** through triggers and application logic
- **Complete audit trail** for all changes
- **Automated consistency maintenance** to prevent data corruption
- **Recovery procedures** for data restoration scenarios