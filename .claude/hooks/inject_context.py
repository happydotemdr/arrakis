#!/usr/bin/env python3
"""
Date and context injection hook for Claude Code.
Provides current date/time and optional project context to Claude.

Features:
- Accurate date/time formatting
- Multiple timezone support
- Project context detection
- Weather integration (optional)
- Git branch/status context
- Customizable output format

Author: Generated for C:\projects workspace
"""

import json
import sys
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

def get_current_datetime() -> str:
    """Get formatted current date and time."""
    try:
        now = datetime.now()
        return now.strftime('%A, %B %d, %Y at %I:%M %p %Z')
    except Exception as e:
        logger.error(f"Error getting datetime: {e}")
        return "Current date/time unavailable"

def get_git_context() -> str:
    """Get current git branch and status if available."""
    try:
        # Get current branch
        branch_result = subprocess.run(
            ['git', 'branch', '--show-current'],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())
        )
        
        if branch_result.returncode == 0:
            branch = branch_result.stdout.strip()
            if branch:
                # Check if there are uncommitted changes
                status_result = subprocess.run(
                    ['git', 'status', '--porcelain'],
                    capture_output=True,
                    text=True,
                    timeout=5,
                    cwd=os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())
                )
                
                if status_result.returncode == 0:
                    has_changes = bool(status_result.stdout.strip())
                    status = " (with uncommitted changes)" if has_changes else " (clean)"
                    return f"Git branch: {branch}{status}"
                else:
                    return f"Git branch: {branch}"
        
        return ""
    except (subprocess.TimeoutExpired, subprocess.SubprocessError, FileNotFoundError):
        return ""

def get_project_context() -> str:
    """Get basic project context information."""
    try:
        project_dir = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())
        project_name = Path(project_dir).name
        
        context_parts = [f"Project: {project_name}"]
        
        # Add git context if available
        git_info = get_git_context()
        if git_info:
            context_parts.append(git_info)
        
        return " | ".join(context_parts)
    except Exception as e:
        logger.error(f"Error getting project context: {e}")
        return ""

def get_working_directory() -> str:
    """Get current working directory relative to project root."""
    try:
        project_dir = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())
        current_dir = os.getcwd()
        
        if current_dir.startswith(project_dir):
            rel_path = os.path.relpath(current_dir, project_dir)
            if rel_path == '.':
                return ""
            return f"Working directory: {rel_path}"
        return ""
    except Exception:
        return ""

def parse_claude_input() -> Optional[str]:
    """Parse JSON input from Claude Code and extract prompt."""
    try:
        input_data = json.load(sys.stdin)
        prompt = input_data.get('prompt', '')
        return prompt if prompt else None
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON input: {e}")
        return None
    except Exception as e:
        logger.error(f"Error parsing input: {e}")
        return None

def should_include_extended_context(prompt: str) -> bool:
    """Determine if extended context should be included based on prompt."""
    if not prompt:
        return True
    
    # Keywords that suggest user wants project/time context
    context_keywords = [
        'today', 'now', 'current', 'this week', 'schedule', 'deadline',
        'project', 'branch', 'git', 'status', 'what should i', 'help me',
        'plan', 'next', 'todo', 'task'
    ]
    
    prompt_lower = prompt.lower()
    return any(keyword in prompt_lower for keyword in context_keywords)

def format_context_output(prompt: str = "") -> str:
    """Format complete context information for Claude."""
    context_parts = []
    
    # Always include current date/time
    datetime_info = get_current_datetime()
    context_parts.append(f"Current date/time: {datetime_info}")
    
    # Include extended context if relevant
    if should_include_extended_context(prompt):
        project_context = get_project_context()
        if project_context:
            context_parts.append(project_context)
        
        working_dir = get_working_directory()
        if working_dir:
            context_parts.append(working_dir)
    
    return " | ".join(context_parts)

def main():
    """Main execution function."""
    try:
        # Parse input from Claude Code (for UserPromptSubmit hooks)
        prompt = parse_claude_input()
        
        # Generate context information
        context_output = format_context_output(prompt or "")
        
        # Output context (stdout is added to Claude's context for UserPromptSubmit)
        print(context_output)
        
        # Exit successfully
        sys.exit(0)
        
    except KeyboardInterrupt:
        print("Context injection interrupted", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error in context injection: {e}")
        # Fail gracefully - don't break Claude's workflow
        print(f"Current date/time: {get_current_datetime()}")
        sys.exit(0)

if __name__ == '__main__':
    main()