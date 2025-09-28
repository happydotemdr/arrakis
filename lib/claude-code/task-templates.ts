/**
 * Claude Code Task Templates
 *
 * Predefined tasks that demonstrate the Claude Code component capabilities
 */

import type { ClaudeCodeTask } from './claude-code-manager'
import { randomUUID } from 'crypto'

export interface TaskTemplate {
  id: string
  name: string
  description: string
  category: 'analysis' | 'improvement' | 'feature' | 'maintenance' | 'testing'
  estimatedDuration: number // in minutes
  createTask: (customPrompt?: string) => ClaudeCodeTask
}

/**
 * Predefined task templates for the proof of concept
 */
export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'analyze-codebase',
    name: 'Analyze Codebase',
    description: 'Perform a comprehensive analysis of the Arrakis codebase',
    category: 'analysis',
    estimatedDuration: 5,
    createTask: (customPrompt?: string) => ({
      id: randomUUID(),
      title: 'Codebase Analysis',
      prompt: customPrompt || `Please analyze the Arrakis codebase and provide insights:

1. **Code Quality Assessment**
   - Review TypeScript code quality and patterns
   - Check for potential bugs or improvements
   - Assess component architecture and organization

2. **Performance Analysis**
   - Look for performance bottlenecks
   - Check database query efficiency
   - Review bundle size and optimization opportunities

3. **Security Review**
   - Check for security vulnerabilities
   - Review environment variable handling
   - Assess API endpoint security

4. **Technical Debt**
   - Identify areas that need refactoring
   - Look for outdated dependencies
   - Check for TODO comments and incomplete features

5. **Recommendations**
   - Provide specific, actionable recommendations
   - Prioritize suggestions by impact and effort
   - Suggest implementation approaches

Please be thorough but focus on the most important findings. Use your Read tool to explore the codebase systematically.`,
      workingDirectory: process.cwd(),
      timeout: 10 * 60 * 1000, // 10 minutes
      captureToDatabase: true
    })
  },

  {
    id: 'fix-typescript-errors',
    name: 'Fix TypeScript Errors',
    description: 'Identify and fix any TypeScript compilation errors',
    category: 'maintenance',
    estimatedDuration: 3,
    createTask: (customPrompt?: string) => ({
      id: randomUUID(),
      title: 'TypeScript Error Fixes',
      prompt: customPrompt || `Please check for and fix any TypeScript errors in the Arrakis codebase:

1. **Run Type Check**
   - Use 'bun run type-check' to identify TypeScript errors
   - Review all error messages and their locations

2. **Fix Type Errors**
   - Analyze each error and implement appropriate fixes
   - Ensure type safety is maintained
   - Add proper type definitions where needed

3. **Verify Fixes**
   - Run type-check again to confirm all errors are resolved
   - Ensure the build still works with 'bun run build'

4. **Code Quality**
   - Improve type definitions while fixing errors
   - Add proper type annotations where beneficial
   - Ensure consistency with existing patterns

This is a focused task - only fix actual TypeScript compilation errors, don't make unnecessary changes.`,
      workingDirectory: process.cwd(),
      timeout: 8 * 60 * 1000, // 8 minutes
      captureToDatabase: true
    })
  },

  {
    id: 'improve-component',
    name: 'Improve Component',
    description: 'Select and improve a specific React component',
    category: 'improvement',
    estimatedDuration: 7,
    createTask: (customPrompt?: string) => ({
      id: randomUUID(),
      title: 'Component Improvement',
      prompt: customPrompt || `Please select and improve a React component in the Arrakis app:

1. **Component Selection**
   - Browse the components/ directory
   - Choose a component that could benefit from improvement
   - Explain your selection criteria

2. **Analysis**
   - Review the component's current implementation
   - Identify areas for improvement (performance, UX, code quality)
   - Check how it's used throughout the app

3. **Improvements**
   - Implement meaningful enhancements
   - Could include: better TypeScript types, accessibility, performance, UX
   - Add comments explaining your changes

4. **Testing**
   - Ensure the component still builds correctly
   - Check that the changes don't break the app
   - Test any new functionality

5. **Documentation**
   - Document your changes and reasoning
   - Explain the benefits of your improvements

Focus on making real, valuable improvements that demonstrate your development capabilities.`,
      workingDirectory: process.cwd(),
      timeout: 15 * 60 * 1000, // 15 minutes
      captureToDatabase: true
    })
  },

  {
    id: 'add-feature',
    name: 'Add New Feature',
    description: 'Add a small but meaningful new feature to the application',
    category: 'feature',
    estimatedDuration: 10,
    createTask: (customPrompt?: string) => ({
      id: randomUUID(),
      title: 'New Feature Implementation',
      prompt: customPrompt || `Please add a small but meaningful new feature to the Arrakis application:

1. **Feature Planning**
   - Analyze the current app structure and identify a good feature to add
   - Choose something that demonstrates your full development capabilities
   - Examples: export functionality, keyboard shortcuts, theme toggle, etc.

2. **Implementation**
   - Create any necessary new components or utilities
   - Update existing components as needed
   - Follow the existing code patterns and architecture
   - Ensure proper TypeScript typing

3. **Integration**
   - Wire up the feature to the appropriate parts of the app
   - Add any necessary API endpoints or database changes
   - Ensure the feature works end-to-end

4. **Testing & Quality**
   - Test the feature thoroughly
   - Run type-check and build to ensure no regressions
   - Follow the app's existing patterns and conventions

5. **Documentation**
   - Document what you built and how it works
   - Explain your design decisions

This should be a complete, working feature that adds real value to the application.`,
      workingDirectory: process.cwd(),
      timeout: 20 * 60 * 1000, // 20 minutes
      captureToDatabase: true
    })
  },

  {
    id: 'self-improvement',
    name: 'Self-Improvement',
    description: 'Improve the Claude Code integration system itself',
    category: 'improvement',
    estimatedDuration: 8,
    createTask: (customPrompt?: string) => ({
      id: randomUUID(),
      title: 'Claude Code System Self-Improvement',
      prompt: customPrompt || `Please improve the Claude Code integration system itself (the very code that runs you!):

1. **System Analysis**
   - Review the claude-code-manager.ts and related files
   - Identify opportunities for improvement
   - Look for missing features or edge cases

2. **Improvements**
   - Enhance error handling and logging
   - Add better progress tracking
   - Improve the task template system
   - Add missing TypeScript types or documentation

3. **New Capabilities**
   - Add features that would make the Claude Code system more powerful
   - Consider adding real-time progress updates
   - Add better session management

4. **Testing**
   - Ensure your changes don't break the existing functionality
   - Test the improved system

5. **Meta-Documentation**
   - Document your self-improvements
   - Explain how you improved your own execution system

This is a fascinating meta-task: Claude Code improving Claude Code! Show your capability for self-reflection and system improvement.`,
      workingDirectory: process.cwd(),
      timeout: 15 * 60 * 1000, // 15 minutes
      captureToDatabase: true
    })
  },

  {
    id: 'custom-task',
    name: 'Custom Task',
    description: 'Execute a custom task with a user-defined prompt',
    category: 'analysis',
    estimatedDuration: 10,
    createTask: (customPrompt?: string) => ({
      id: randomUUID(),
      title: 'Custom Claude Code Task',
      prompt: customPrompt || 'Please provide a specific task description.',
      workingDirectory: process.cwd(),
      timeout: 15 * 60 * 1000, // 15 minutes
      captureToDatabase: true
    })
  }
]

/**
 * Get a task template by ID
 */
export function getTaskTemplate(templateId: string): TaskTemplate | undefined {
  return TASK_TEMPLATES.find(template => template.id === templateId)
}

/**
 * Get task templates by category
 */
export function getTaskTemplatesByCategory(category: TaskTemplate['category']): TaskTemplate[] {
  return TASK_TEMPLATES.filter(template => template.category === category)
}

/**
 * Create a quick analysis task
 */
export function createQuickAnalysisTask(focus?: string): ClaudeCodeTask {
  return {
    id: randomUUID(),
    title: 'Quick Analysis',
    prompt: `Please perform a quick analysis of the Arrakis codebase${focus ? ` focusing on: ${focus}` : ''}.

Provide a concise overview of:
- Current state and quality
- Any immediate issues or opportunities
- Quick recommendations

Keep this analysis brief but insightful.`,
    workingDirectory: process.cwd(),
    timeout: 5 * 60 * 1000, // 5 minutes
    captureToDatabase: true
  }
}

/**
 * Create a demonstration task to show Claude Code capabilities
 */
export function createDemoTask(): ClaudeCodeTask {
  return {
    id: randomUUID(),
    title: 'Claude Code Capabilities Demo',
    prompt: `Welcome to the Claude Code component of the Arrakis dual strategy system!

Please demonstrate your capabilities by:

1. **Reading the codebase**: Use your Read tool to explore key files
2. **Running commands**: Use Bash to run type-check and see the current state
3. **Making an improvement**: Make a small but meaningful improvement to the code
4. **Verifying your work**: Run tests/checks to ensure everything still works

This is a proof of concept to show how Claude Code (System B) differs from the basic Claude API (System A) by having full development tool access.

Show off your capabilities while being productive and helpful!`,
    workingDirectory: process.cwd(),
    timeout: 12 * 60 * 1000, // 12 minutes
    captureToDatabase: true
  }
}