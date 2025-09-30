# Enhanced Roadmap Schema Design

## Core Schema Extensions

```prisma
// Enhanced Epic model with extensibility patterns
model Epic {
  id           String    @id @default(uuid())
  title        String    @db.VarChar(200)
  description  String?   @db.Text
  status       EpicStatus @default(PLANNED)
  priority     Priority  @default(MEDIUM)
  quarter      String?   @db.VarChar(7)  // Format: "Q1 2025"
  outcome      String?   @db.Text
  icon         String?   @db.VarChar(10) // Emoji storage
  color        String?   @db.Char(7)     // Hex format #RRGGBB

  // CRITICAL: Decimal ordering prevents race conditions
  displayOrder Decimal   @default(1000) @map("display_order") @db.Decimal(20, 10)

  // CRITICAL: Optimistic locking
  version      Int       @default(1)

  // Extended metadata and planning fields
  effort       Int?      // Story points or hours
  businessValue Int?     // 1-10 scale
  risk         RiskLevel @default(LOW)
  dependencies String?   @db.Text // Free-text dependencies
  acceptanceCriteria String? @db.Text

  // Timeline planning
  startDate    DateTime? @map("start_date") @db.Date
  targetDate   DateTime? @map("target_date") @db.Date
  completedDate DateTime? @map("completed_date") @db.Date

  // Relationships
  projectId    String?   @map("project_id")
  parentEpicId String?   @map("parent_epic_id") // For epic hierarchies

  // Soft delete and audit
  deletedAt    DateTime? @map("deleted_at") @db.Timestamptz
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  createdBy    String?   @map("created_by") // Future: user ID
  lastModifiedBy String? @map("last_modified_by") // Future: user ID

  // Relations
  project      Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  parentEpic   Epic?     @relation("EpicHierarchy", fields: [parentEpicId], references: [id], onDelete: SetNull)
  childEpics   Epic[]    @relation("EpicHierarchy")
  labels       EpicLabel[]
  attachments  EpicAttachment[]
  comments     EpicComment[]
  history      EpicHistory[]

  // Performance indexes for common query patterns
  @@index([displayOrder], map: "idx_epic_display_order", type: BTree)
  @@index([status, displayOrder], map: "idx_epic_status_order")
  @@index([priority, displayOrder], map: "idx_epic_priority_order")
  @@index([quarter, displayOrder], map: "idx_epic_quarter_order")
  @@index([projectId, displayOrder], map: "idx_epic_project_order")
  @@index([parentEpicId], map: "idx_epic_parent")
  @@index([startDate, targetDate], map: "idx_epic_timeline")
  @@index([deletedAt], map: "idx_epic_soft_delete")
  @@index([createdAt], map: "idx_epic_created")
  @@index([updatedAt], map: "idx_epic_updated")
  @@index([businessValue, risk], map: "idx_epic_value_risk")

  @@map("epics")
}

// Project organization for epics
model Project {
  id          String    @id @default(uuid())
  name        String    @db.VarChar(100)
  key         String    @unique @db.VarChar(10) // Short identifier like "WEB"
  description String?   @db.Text
  color       String?   @db.Char(7)
  status      ProjectStatus @default(ACTIVE)

  // Project hierarchy
  parentProjectId String? @map("parent_project_id")
  displayOrder    Decimal @default(1000) @map("display_order") @db.Decimal(20, 10)

  // Metadata
  startDate   DateTime? @map("start_date") @db.Date
  endDate     DateTime? @map("end_date") @db.Date

  // Audit fields
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt   DateTime? @map("deleted_at") @db.Timestamptz

  // Relations
  parentProject Project? @relation("ProjectHierarchy", fields: [parentProjectId], references: [id])
  childProjects Project[] @relation("ProjectHierarchy")
  epics        Epic[]

  @@index([key], map: "idx_project_key")
  @@index([status, displayOrder], map: "idx_project_status_order")
  @@index([parentProjectId], map: "idx_project_parent")
  @@index([deletedAt], map: "idx_project_soft_delete")

  @@map("projects")
}

// Flexible labeling system
model Label {
  id          String    @id @default(uuid())
  name        String    @unique @db.VarChar(50)
  color       String    @db.Char(7)
  description String?   @db.VarChar(200)
  category    LabelCategory @default(GENERAL)

  // Audit
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  epicLabels  EpicLabel[]

  @@index([category], map: "idx_label_category")
  @@index([name], map: "idx_label_name")

  @@map("labels")
}

// Many-to-many relationship for epic labels
model EpicLabel {
  id      String @id @default(uuid())
  epicId  String @map("epic_id")
  labelId String @map("label_id")

  // Additional metadata for the relationship
  addedAt DateTime @default(now()) @map("added_at") @db.Timestamptz
  addedBy String?  @map("added_by") // Future: user ID

  // Relations
  epic    Epic   @relation(fields: [epicId], references: [id], onDelete: Cascade)
  label   Label  @relation(fields: [labelId], references: [id], onDelete: Cascade)

  @@unique([epicId, labelId])
  @@index([epicId], map: "idx_epic_label_epic")
  @@index([labelId], map: "idx_epic_label_label")

  @@map("epic_labels")
}

// File attachments for epics
model EpicAttachment {
  id          String    @id @default(uuid())
  epicId      String    @map("epic_id")
  filename    String    @db.VarChar(255)
  originalName String   @map("original_name") @db.VarChar(255)
  mimeType    String    @map("mime_type") @db.VarChar(100)
  size        Int       // File size in bytes
  url         String?   @db.VarChar(500) // URL or file path

  // Metadata
  uploadedAt  DateTime  @default(now()) @map("uploaded_at") @db.Timestamptz
  uploadedBy  String?   @map("uploaded_by") // Future: user ID

  // Relations
  epic        Epic      @relation(fields: [epicId], references: [id], onDelete: Cascade)

  @@index([epicId], map: "idx_epic_attachment_epic")
  @@index([uploadedAt], map: "idx_epic_attachment_date")

  @@map("epic_attachments")
}

// Comments and discussion on epics
model EpicComment {
  id        String   @id @default(uuid())
  epicId    String   @map("epic_id")
  content   String   @db.Text

  // Audit
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
  createdBy String?  @map("created_by") // Future: user ID

  // Relations
  epic      Epic     @relation(fields: [epicId], references: [id], onDelete: Cascade)

  @@index([epicId, createdAt], map: "idx_epic_comment_epic_date")

  @@map("epic_comments")
}

// Audit trail for epic changes
model EpicHistory {
  id         String   @id @default(uuid())
  epicId     String   @map("epic_id")
  field      String   @db.VarChar(50)  // Field that changed
  oldValue   String?  @map("old_value") @db.Text
  newValue   String?  @map("new_value") @db.Text
  changeType ChangeType @map("change_type")

  // Audit
  changedAt  DateTime @default(now()) @map("changed_at") @db.Timestamptz
  changedBy  String?  @map("changed_by") // Future: user ID

  // Relations
  epic       Epic     @relation(fields: [epicId], references: [id], onDelete: Cascade)

  @@index([epicId, changedAt], map: "idx_epic_history_epic_date")
  @@index([field], map: "idx_epic_history_field")
  @@index([changeType], map: "idx_epic_history_type")

  @@map("epic_history")
}

// Enums
enum EpicStatus {
  PLANNED
  IN_PROGRESS
  BLOCKED
  REVIEW
  COMPLETED
  CANCELLED
  ON_HOLD
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
  URGENT
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum ProjectStatus {
  ACTIVE
  ARCHIVED
  COMPLETED
  ON_HOLD
}

enum LabelCategory {
  GENERAL
  TECHNOLOGY
  TEAM
  PRIORITY
  RISK
  MILESTONE
  FEATURE_TYPE
}

enum ChangeType {
  CREATED
  UPDATED
  DELETED
  RESTORED
  STATUS_CHANGED
  REORDERED
}
```

## Advanced Indexing Strategy

```sql
-- Specialized indexes for complex query patterns

-- Multi-column indexes for filtered ordering
CREATE INDEX CONCURRENTLY idx_epic_complex_filter
ON epics (status, priority, project_id, display_order)
WHERE deleted_at IS NULL;

-- Partial indexes for active items
CREATE INDEX CONCURRENTLY idx_epic_active_items
ON epics (display_order, updated_at)
WHERE deleted_at IS NULL AND status != 'COMPLETED';

-- Timeline planning indexes
CREATE INDEX CONCURRENTLY idx_epic_overdue
ON epics (target_date, status)
WHERE deleted_at IS NULL AND target_date < CURRENT_DATE AND status != 'COMPLETED';

-- Risk and value assessment
CREATE INDEX CONCURRENTLY idx_epic_portfolio_view
ON epics (business_value DESC, risk ASC, effort ASC)
WHERE deleted_at IS NULL;

-- Label-based filtering with covering index
CREATE INDEX CONCURRENTLY idx_epic_label_performance
ON epic_labels (label_id, epic_id)
INCLUDE (added_at);

-- Project hierarchy navigation
CREATE INDEX CONCURRENTLY idx_project_tree_path
ON projects (parent_project_id, display_order)
WHERE deleted_at IS NULL;
```

## Vector Search Integration

```sql
-- Add vector embeddings for epic content search
ALTER TABLE epics ADD COLUMN content_embedding vector(1536);

-- Create HNSW index for semantic search
CREATE INDEX CONCURRENTLY idx_epic_content_vector_hnsw
ON epics USING hnsw (content_embedding vector_cosine_ops)
WHERE content_embedding IS NOT NULL AND deleted_at IS NULL;

-- Function to automatically update embeddings
CREATE OR REPLACE FUNCTION update_epic_embedding()
RETURNS TRIGGER AS $$
BEGIN
  -- This would integrate with your embedding service
  -- For now, just mark that embedding needs update
  NEW.content_embedding = NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update embeddings when content changes
CREATE TRIGGER epic_embedding_update
AFTER UPDATE OF title, description, outcome, acceptance_criteria ON epics
FOR EACH ROW
EXECUTE FUNCTION update_epic_embedding();
```