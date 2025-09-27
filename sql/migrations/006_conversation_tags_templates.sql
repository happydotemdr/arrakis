-- Migration: Add conversation tags and templates system
-- Date: 2025-01-14
-- Description: Add conversation tagging and template functionality for enhanced organization

-- Conversation tags table
CREATE TABLE conversation_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Session tags junction table (many-to-many)
CREATE TABLE session_tags (
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES conversation_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id, tag_id)
);

-- Conversation templates table
CREATE TABLE conversation_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    template TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    is_public BOOLEAN DEFAULT FALSE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_session_tags_session_id ON session_tags(session_id);
CREATE INDEX idx_session_tags_tag_id ON session_tags(tag_id);
CREATE INDEX idx_conversation_tags_name ON conversation_tags(name);
CREATE INDEX idx_conversation_templates_user_id ON conversation_templates(user_id);
CREATE INDEX idx_conversation_templates_category ON conversation_templates(category);

-- Insert default conversation tags
INSERT INTO conversation_tags (name, color, description) VALUES
    ('debugging', '#ef4444', 'Sessions focused on debugging and troubleshooting'),
    ('development', '#10b981', 'General development and coding sessions'),
    ('learning', '#3b82f6', 'Educational and learning conversations'),
    ('research', '#8b5cf6', 'Research and exploration sessions'),
    ('optimization', '#f59e0b', 'Performance and optimization discussions'),
    ('planning', '#06b6d4', 'Project planning and architecture sessions'),
    ('review', '#ec4899', 'Code review and analysis sessions');

-- Insert default conversation templates
INSERT INTO conversation_templates (name, description, template, category, is_public, user_id) VALUES
    ('Bug Report', 'Template for reporting and debugging issues',
     'I''m encountering an issue with {{component}}. Here are the details:\n\n**Problem Description:**\n{{description}}\n\n**Steps to Reproduce:**\n1. {{step1}}\n2. {{step2}}\n3. {{step3}}\n\n**Expected Behavior:**\n{{expected}}\n\n**Actual Behavior:**\n{{actual}}\n\n**Environment:**\n- OS: {{os}}\n- Version: {{version}}\n\n**Additional Context:**\n{{context}}',
     'debugging', true, 1),

    ('Code Review', 'Template for code review sessions',
     'Please review the following code:\n\n```{{language}}\n{{code}}\n```\n\n**Context:**\n{{context}}\n\n**Specific areas to focus on:**\n- {{focus1}}\n- {{focus2}}\n- {{focus3}}\n\n**Questions:**\n1. {{question1}}\n2. {{question2}}',
     'development', true, 1),

    ('Feature Planning', 'Template for planning new features',
     'I want to implement a new feature: {{feature_name}}\n\n**Purpose:**\n{{purpose}}\n\n**User Stories:**\n- As a {{user_type}}, I want {{goal}} so that {{benefit}}\n\n**Acceptance Criteria:**\n- {{criteria1}}\n- {{criteria2}}\n- {{criteria3}}\n\n**Technical Considerations:**\n{{technical_notes}}\n\n**Questions:**\n{{questions}}',
     'planning', true, 1),

    ('Performance Analysis', 'Template for performance optimization sessions',
     'I need help analyzing performance issues in {{component}}.\n\n**Current Performance:**\n{{current_metrics}}\n\n**Target Performance:**\n{{target_metrics}}\n\n**Bottlenecks Identified:**\n- {{bottleneck1}}\n- {{bottleneck2}}\n\n**Code/Config:**\n```{{language}}\n{{code}}\n```\n\n**Profiling Data:**\n{{profiling_data}}\n\n**Constraints:**\n{{constraints}}',
     'optimization', true, 1);

-- Update updated_at trigger for conversation_templates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversation_templates_updated_at
    BEFORE UPDATE ON conversation_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();