#!/usr/bin/env python3
"""
AI-Powered Context Injection Hook for Claude Code.
Provides intelligent, intent-aware context analysis for enhanced development outcomes.

Features:
- Smart file analysis with AST parsing
- Recent modifications scanner with semantic understanding
- Error pattern detection from build/test logs
- Intent-based context selection (debug/architecture/feature/review)
- Project intelligence with framework detection
- Dynamic context relevance scoring
- Advanced git analysis with change impact assessment

Author: Enhanced AI Development Acceleration System
"""

import json
import sys
import os
import subprocess
import ast
import re
import glob
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set, Any
from collections import defaultdict
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


# ============================================================================
# SMART FILE ANALYSIS SYSTEM
# ============================================================================

class FileAnalyzer:
    """Advanced file analysis with AST parsing and semantic understanding."""

    def __init__(self, project_dir: str):
        self.project_dir = project_dir
        self.supported_extensions = {'.py', '.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.yaml', '.yml'}

    def analyze_recent_changes(self) -> Dict[str, Any]:
        """Analyze recently modified files and extract relevant context."""
        try:
            # Get files modified in last 24 hours or staged changes
            recent_files = self._get_recent_files()
            if not recent_files:
                return {}

            analysis = {
                'modified_files': [],
                'code_patterns': [],
                'api_changes': [],
                'config_changes': [],
                'new_dependencies': []
            }

            for file_path in recent_files:
                file_analysis = self._analyze_file(file_path)
                if file_analysis:
                    analysis['modified_files'].append(file_analysis)

            return analysis
        except Exception as e:
            logger.error(f"Error analyzing recent changes: {e}")
            return {}

    def _get_recent_files(self) -> List[str]:
        """Get list of recently modified or staged files."""
        try:
            # Get staged files
            staged_result = subprocess.run(
                ['git', 'diff', '--cached', '--name-only'],
                capture_output=True, text=True, timeout=5, cwd=self.project_dir
            )

            # Get modified files in last 24 hours
            recent_result = subprocess.run(
                ['git', 'diff', '--name-only', 'HEAD~1'],
                capture_output=True, text=True, timeout=5, cwd=self.project_dir
            )

            files = set()
            if staged_result.returncode == 0:
                files.update(staged_result.stdout.strip().split('\n'))
            if recent_result.returncode == 0:
                files.update(recent_result.stdout.strip().split('\n'))

            # Filter for supported file types and existing files
            return [f for f in files if f and
                   Path(self.project_dir, f).suffix in self.supported_extensions and
                   Path(self.project_dir, f).exists()]

        except Exception as e:
            logger.error(f"Error getting recent files: {e}")
            return []

    def _analyze_file(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Analyze individual file for semantic content."""
        try:
            full_path = Path(self.project_dir, file_path)
            if not full_path.exists():
                return None

            analysis = {
                'path': file_path,
                'type': full_path.suffix,
                'size_bytes': full_path.stat().st_size,
                'functions': [],
                'classes': [],
                'imports': [],
                'exports': [],
                'api_endpoints': [],
                'database_queries': [],
                'configuration_changes': []
            }

            content = full_path.read_text(encoding='utf-8', errors='ignore')

            # Python file analysis
            if full_path.suffix == '.py':
                self._analyze_python_file(content, analysis)

            # JavaScript/TypeScript file analysis
            elif full_path.suffix in {'.js', '.ts', '.jsx', '.tsx'}:
                self._analyze_js_file(content, analysis)

            # JSON configuration analysis
            elif full_path.suffix == '.json':
                self._analyze_json_file(content, analysis)

            # Markdown analysis
            elif full_path.suffix == '.md':
                self._analyze_markdown_file(content, analysis)

            return analysis

        except Exception as e:
            logger.error(f"Error analyzing file {file_path}: {e}")
            return None

    def _analyze_python_file(self, content: str, analysis: Dict[str, Any]):
        """Analyze Python file using AST parsing."""
        try:
            tree = ast.parse(content)

            for node in ast.walk(tree):
                # Function definitions
                if isinstance(node, ast.FunctionDef):
                    analysis['functions'].append({
                        'name': node.name,
                        'args': [arg.arg for arg in node.args.args],
                        'line': node.lineno,
                        'is_async': isinstance(node, ast.AsyncFunctionDef)
                    })

                # Class definitions
                elif isinstance(node, ast.ClassDef):
                    analysis['classes'].append({
                        'name': node.name,
                        'bases': [base.id if hasattr(base, 'id') else str(base) for base in node.bases],
                        'line': node.lineno
                    })

                # Import statements
                elif isinstance(node, (ast.Import, ast.ImportFrom)):
                    if isinstance(node, ast.Import):
                        for alias in node.names:
                            analysis['imports'].append(alias.name)
                    else:
                        module = node.module or ''
                        for alias in node.names:
                            analysis['imports'].append(f"{module}.{alias.name}")

        except Exception as e:
            logger.error(f"Error parsing Python AST: {e}")

    def _analyze_js_file(self, content: str, analysis: Dict[str, Any]):
        """Analyze JavaScript/TypeScript file using regex patterns."""
        try:
            # Function declarations
            func_patterns = [
                r'function\s+(\w+)\s*\(',
                r'const\s+(\w+)\s*=\s*(?:async\s+)?\(',
                r'export\s+(?:async\s+)?function\s+(\w+)\s*\(',
                r'(\w+)\s*:\s*(?:async\s+)?\('
            ]

            for pattern in func_patterns:
                matches = re.finditer(pattern, content)
                for match in matches:
                    analysis['functions'].append({
                        'name': match.group(1),
                        'line': content[:match.start()].count('\n') + 1
                    })

            # API endpoints (Express.js style)
            api_pattern = r'(?:router|app)\.(?:get|post|put|delete|patch)\s*\(\s*[\'"]([^\'"]+)[\'"]'
            for match in re.finditer(api_pattern, content):
                analysis['api_endpoints'].append(match.group(1))

            # Import/export statements
            import_patterns = [
                r'import\s+.*?\s+from\s+[\'"]([^\'"]+)[\'"]',
                r'require\s*\(\s*[\'"]([^\'"]+)[\'"]',
                r'export\s+.*?\s+from\s+[\'"]([^\'"]+)[\'"]'
            ]

            for pattern in import_patterns:
                matches = re.finditer(pattern, content)
                for match in matches:
                    analysis['imports'].append(match.group(1))

        except Exception as e:
            logger.error(f"Error analyzing JS file: {e}")

    def _analyze_json_file(self, content: str, analysis: Dict[str, Any]):
        """Analyze JSON configuration files."""
        try:
            data = json.loads(content)

            # Package.json analysis
            if 'dependencies' in data or 'devDependencies' in data:
                analysis['configuration_changes'].append('package_dependencies')
                deps = {**data.get('dependencies', {}), **data.get('devDependencies', {})}
                analysis['new_dependencies'] = list(deps.keys())

            # Configuration detection
            config_indicators = ['database', 'api', 'server', 'client', 'build', 'scripts']
            for indicator in config_indicators:
                if indicator in data:
                    analysis['configuration_changes'].append(indicator)

        except Exception as e:
            logger.error(f"Error analyzing JSON file: {e}")

    def _analyze_markdown_file(self, content: str, analysis: Dict[str, Any]):
        """Analyze markdown files for documentation changes."""
        try:
            # Extract headings
            headings = re.findall(r'^#{1,6}\s+(.+)$', content, re.MULTILINE)
            analysis['documentation_sections'] = headings

            # Check for code blocks
            code_blocks = re.findall(r'```(\w+)?', content)
            analysis['code_languages'] = list(set(filter(None, code_blocks)))

        except Exception as e:
            logger.error(f"Error analyzing markdown file: {e}")


class ErrorPatternDetector:
    """Detect and analyze error patterns from logs and build outputs."""

    def __init__(self, project_dir: str):
        self.project_dir = project_dir
        self.log_patterns = {
            'build_error': r'(?i)error.*?(?:failed|error|exception)',
            'test_failure': r'(?i)(?:test|spec).*?(?:failed|error|assertion)',
            'lint_warning': r'(?i)(?:warning|warn).*?(?:lint|style)',
            'dependency_error': r'(?i)(?:module|package).*?(?:not found|missing|unresolved)'
        }

    def detect_recent_errors(self) -> Dict[str, Any]:
        """Scan for recent error patterns in logs and build outputs."""
        try:
            error_context = {
                'build_errors': [],
                'test_failures': [],
                'lint_issues': [],
                'dependency_issues': [],
                'recent_logs': []
            }

            # Check common log locations
            log_locations = [
                './*.log',
                './logs/*.log',
                './build/*.log',
                './test-results/*.log',
                './.next/*.log'
            ]

            for pattern in log_locations:
                for log_file in glob.glob(os.path.join(self.project_dir, pattern)):
                    try:
                        with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            self._analyze_log_content(content, error_context)
                    except Exception as e:
                        logger.error(f"Error reading log file {log_file}: {e}")

            return error_context

        except Exception as e:
            logger.error(f"Error detecting error patterns: {e}")
            return {}

    def _analyze_log_content(self, content: str, error_context: Dict[str, Any]):
        """Analyze log content for error patterns."""
        for error_type, pattern in self.log_patterns.items():
            matches = re.findall(pattern, content)
            if matches:
                key_mapping = {
                    'build_error': 'build_errors',
                    'test_failure': 'test_failures',
                    'lint_warning': 'lint_issues',
                    'dependency_error': 'dependency_issues'
                }
                key = key_mapping.get(error_type, 'recent_logs')
                error_context[key].extend(matches[:3])  # Limit to 3 most recent


class IntentDetector:
    """Detect user intent from prompt to provide relevant context."""

    def __init__(self):
        self.intent_patterns = {
            'debug': [
                'debug', 'fix', 'error', 'bug', 'issue', 'problem', 'broken', 'failing',
                'exception', 'crash', 'not working', 'wrong', 'incorrect'
            ],
            'architecture': [
                'architecture', 'design', 'structure', 'organize', 'refactor', 'pattern',
                'scalable', 'maintainable', 'modular', 'system', 'overview', 'diagram'
            ],
            'feature': [
                'add', 'create', 'implement', 'build', 'develop', 'feature', 'functionality',
                'new', 'enhance', 'improve', 'extend', 'capability'
            ],
            'review': [
                'review', 'check', 'validate', 'assess', 'evaluate', 'quality', 'best practices',
                'security', 'performance', 'optimize', 'standards', 'clean'
            ]
        }

    def detect_intent(self, prompt: str) -> List[str]:
        """Detect primary intent(s) from user prompt."""
        if not prompt:
            return ['general']

        prompt_lower = prompt.lower()
        detected_intents = []

        for intent, keywords in self.intent_patterns.items():
            if any(keyword in prompt_lower for keyword in keywords):
                detected_intents.append(intent)

        return detected_intents if detected_intents else ['general']


class ProjectIntelligenceEngine:
    """Analyze project structure and detect frameworks, patterns, and architecture."""

    def __init__(self, project_dir: str):
        self.project_dir = project_dir

    def analyze_project_intelligence(self) -> Dict[str, Any]:
        """Comprehensive project analysis."""
        try:
            intelligence = {
                'frameworks': [],
                'languages': set(),
                'architecture_patterns': [],
                'database_type': None,
                'deployment_platform': None,
                'testing_frameworks': [],
                'project_type': 'unknown',
                'complexity_score': 0
            }

            # Detect frameworks and technologies
            self._detect_frameworks(intelligence)
            self._detect_architecture_patterns(intelligence)
            self._detect_project_type(intelligence)
            self._calculate_complexity_score(intelligence)

            # Convert set to list for JSON serialization
            intelligence['languages'] = list(intelligence['languages'])

            return intelligence

        except Exception as e:
            logger.error(f"Error analyzing project intelligence: {e}")
            return {}

    def _detect_frameworks(self, intelligence: Dict[str, Any]):
        """Detect frameworks based on file patterns and dependencies."""
        project_path = Path(self.project_dir)

        # Check package.json for Node.js frameworks
        package_json = project_path / 'package.json'
        if package_json.exists():
            try:
                with open(package_json) as f:
                    data = json.load(f)
                    deps = {**data.get('dependencies', {}), **data.get('devDependencies', {})}

                    # Framework detection
                    if 'next' in deps:
                        intelligence['frameworks'].append('Next.js')
                    if 'react' in deps:
                        intelligence['frameworks'].append('React')
                    if 'express' in deps:
                        intelligence['frameworks'].append('Express.js')
                    if '@trpc/server' in deps:
                        intelligence['frameworks'].append('tRPC')
                    if 'drizzle-orm' in deps:
                        intelligence['frameworks'].append('Drizzle ORM')

                    intelligence['languages'].add('JavaScript/TypeScript')
            except Exception as e:
                logger.error(f"Error reading package.json: {e}")

        # Check for Python frameworks
        requirements_files = ['requirements.txt', 'pyproject.toml', 'Pipfile']
        for req_file in requirements_files:
            req_path = project_path / req_file
            if req_path.exists():
                intelligence['languages'].add('Python')
                break

        # Check for specific file patterns
        if (project_path / 'next.config.js').exists():
            intelligence['frameworks'].append('Next.js')
        if (project_path / 'tailwind.config.js').exists():
            intelligence['frameworks'].append('Tailwind CSS')
        if (project_path / 'drizzle.config.ts').exists():
            intelligence['frameworks'].append('Drizzle ORM')

    def _detect_architecture_patterns(self, intelligence: Dict[str, Any]):
        """Detect common architecture patterns."""
        project_path = Path(self.project_dir)

        # Check directory structure for patterns
        if (project_path / 'components').exists():
            intelligence['architecture_patterns'].append('Component-based')
        if (project_path / 'api').exists():
            intelligence['architecture_patterns'].append('API-first')
        if (project_path / 'lib' / 'api').exists():
            intelligence['architecture_patterns'].append('Layered Architecture')
        if (project_path / 'hooks').exists():
            intelligence['architecture_patterns'].append('Hook Pattern')

    def _detect_project_type(self, intelligence: Dict[str, Any]):
        """Determine the primary project type."""
        frameworks = intelligence['frameworks']

        if 'Next.js' in frameworks or 'React' in frameworks:
            intelligence['project_type'] = 'web_application'
        elif 'Express.js' in frameworks:
            intelligence['project_type'] = 'api_server'
        elif Path(self.project_dir, 'package.json').exists():
            intelligence['project_type'] = 'node_application'
        elif Path(self.project_dir, 'requirements.txt').exists():
            intelligence['project_type'] = 'python_application'
        else:
            intelligence['project_type'] = 'general'

    def _calculate_complexity_score(self, intelligence: Dict[str, Any]):
        """Calculate project complexity score (0-10)."""
        score = 0

        # Base score from frameworks
        score += len(intelligence['frameworks'])

        # Language diversity
        score += len(intelligence['languages'])

        # Architecture patterns
        score += len(intelligence['architecture_patterns']) * 0.5

        # File count (rough estimate)
        try:
            file_extensions = ['*.py', '*.js', '*.ts', '*.jsx', '*.tsx']
            file_count = 0
            for ext in file_extensions:
                file_count += len(list(Path(self.project_dir).rglob(ext)))

            if file_count > 100:
                score += 2
            elif file_count > 50:
                score += 1
        except Exception:
            pass

        intelligence['complexity_score'] = min(score, 10)

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


def format_intelligent_context_output(prompt: str = "") -> str:
    """Format AI-powered context information for Claude based on intent and project analysis."""
    try:
        project_dir = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())

        # Initialize analyzers
        intent_detector = IntentDetector()
        file_analyzer = FileAnalyzer(project_dir)
        error_detector = ErrorPatternDetector(project_dir)
        project_intelligence = ProjectIntelligenceEngine(project_dir)

        # Detect user intent
        intents = intent_detector.detect_intent(prompt)

        # Base context
        context_parts = []
        datetime_info = get_current_datetime()
        context_parts.append(f"Date: {datetime_info}")

        # Git context
        git_info = get_git_context()
        if git_info:
            context_parts.append(f"Git: {git_info}")

        # Working directory
        working_dir = get_working_directory()
        if working_dir:
            context_parts.append(f"Dir: {working_dir}")

        # Intent-specific context
        if 'debug' in intents:
            error_context = error_detector.detect_recent_errors()
            if error_context and any(error_context.values()):
                context_parts.append("DEBUG: Recent errors detected - including error context")

        if 'architecture' in intents or 'feature' in intents:
            project_intel = project_intelligence.analyze_project_intelligence()
            if project_intel and project_intel.get('frameworks'):
                frameworks = ', '.join(project_intel['frameworks'])
                context_parts.append(f"ARCH: Project: {project_intel.get('project_type', 'unknown')} | Frameworks: {frameworks}")

        # Recent file changes (relevant for all intents)
        file_analysis = file_analyzer.analyze_recent_changes()
        if file_analysis and file_analysis.get('modified_files'):
            file_count = len(file_analysis['modified_files'])
            context_parts.append(f"FILES: {file_count} recently modified files analyzed")

        # Smart context selection
        if should_include_extended_context(prompt):
            context_details = generate_detailed_context(prompt, intents, file_analysis, error_context if 'debug' in intents else {}, project_intel if 'architecture' in intents or 'feature' in intents else {})
            if context_details:
                context_parts.append(context_details)

        return " | ".join(context_parts)

    except Exception as e:
        logger.error(f"Error in intelligent context formatting: {e}")
        # Fallback to basic context
        return format_basic_context_output(prompt)


def generate_detailed_context(prompt: str, intents: List[str], file_analysis: Dict[str, Any], error_context: Dict[str, Any], project_intel: Dict[str, Any]) -> str:
    """Generate detailed context based on analysis results."""
    details = []

    try:
        # Debug-specific context
        if 'debug' in intents and error_context:
            if error_context.get('build_errors'):
                details.append(f"Build errors: {len(error_context['build_errors'])} recent")
            if error_context.get('test_failures'):
                details.append(f"Test failures: {len(error_context['test_failures'])} detected")

        # Architecture/Feature context
        if ('architecture' in intents or 'feature' in intents) and project_intel:
            if project_intel.get('complexity_score', 0) > 5:
                details.append(f"Complex project (score: {project_intel['complexity_score']}/10)")
            if project_intel.get('architecture_patterns'):
                patterns = ', '.join(project_intel['architecture_patterns'])
                details.append(f"Patterns: {patterns}")

        # File analysis context
        if file_analysis and file_analysis.get('modified_files'):
            api_changes = sum(1 for f in file_analysis['modified_files'] if f.get('api_endpoints'))
            config_changes = sum(1 for f in file_analysis['modified_files'] if f.get('configuration_changes'))

            if api_changes:
                details.append(f"API changes detected in {api_changes} files")
            if config_changes:
                details.append(f"Config changes in {config_changes} files")

        return " | ".join(details) if details else ""

    except Exception as e:
        logger.error(f"Error generating detailed context: {e}")
        return ""


def format_basic_context_output(prompt: str = "") -> str:
    """Fallback basic context formatting."""
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


# Alias for backward compatibility and as main function
format_context_output = format_intelligent_context_output

def main():
    """Main execution function."""
    start_time = time.time()

    try:
        # Parse input from Claude Code (for UserPromptSubmit hooks)
        parse_start = time.time()
        prompt = parse_claude_input()
        parse_time = time.time() - parse_start

        # Generate context information
        context_start = time.time()
        context_output = format_context_output(prompt or "")
        context_time = time.time() - context_start

        # Output context (stdout is added to Claude's context for UserPromptSubmit)
        print(context_output)

        # Performance logging
        total_time = time.time() - start_time
        logger.info(f"Context injection completed - Total: {total_time:.3f}s, Parse: {parse_time:.3f}s, Context: {context_time:.3f}s")

        # Exit successfully
        sys.exit(0)

    except KeyboardInterrupt:
        print("Context injection interrupted", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        total_time = time.time() - start_time
        logger.error(f"Unexpected error in context injection after {total_time:.3f}s: {e}")
        # Fail gracefully - don't break Claude's workflow
        print(f"Current date/time: {get_current_datetime()}")
        sys.exit(0)

if __name__ == '__main__':
    main()