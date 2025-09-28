/**
 * Claude Code Integration (System B)
 *
 * Export all Claude Code functionality for the dual strategy system
 */

// Core manager
export {
  ClaudeCodeManager,
  claudeCodeManager,
  executeClaudeCodeTask,
  getClaudeCodeSession,
  getAllClaudeCodeSessions,
  type ClaudeCodeTask,
  type ClaudeCodeSession,
  type ClaudeCodeResult
} from './claude-code-manager'

// Task templates
export {
  TASK_TEMPLATES,
  getTaskTemplate,
  getTaskTemplatesByCategory,
  createQuickAnalysisTask,
  createDemoTask,
  type TaskTemplate
} from './task-templates'