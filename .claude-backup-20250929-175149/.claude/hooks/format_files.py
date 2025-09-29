#!/usr/bin/env python3
"""
Advanced file formatter for Claude Code hooks.
Integrates Biome, Prettier, and markdownlint for comprehensive formatting.

Features:
- Multi-tool integration (Biome, Prettier, markdownlint)
- Robust error handling and validation
- Path traversal protection
- Configurable file type mappings
- Performance optimized with subprocess timeouts
- Detailed logging and feedback
- Follows Claude Code security best practices

Author: Generated for C:\\projects workspace
"""

import json
import sys
import os
import subprocess
import re
import shutil
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

# Tool configurations
TOOL_CONFIG = {
    'biome': {
        'extensions': {'.js', '.jsx', '.ts', '.tsx', '.json', '.css'},
        'command_template': 'npx biome format --write "{file_path}"',
        'check_command': 'npx biome --version',
        'name': 'Biome'
    },
    'prettier': {
        'extensions': {'.md', '.mdx', '.yaml', '.yml'},
        'command_template': 'npx prettier --write "{file_path}"',
        'check_command': 'npx prettier --version',
        'name': 'Prettier'
    },
    'markdownlint': {
        'extensions': {'.md', '.mdx'},
        'command_template': 'npx markdownlint --fix "{file_path}"',
        'check_command': 'npx markdownlint --version',
        'name': 'markdownlint',
        'run_after': 'prettier'  # Run after prettier for markdown
    }
}

# Security settings
BLOCKED_PATTERNS = [
    r'\.env', r'\.env\.', r'\.key$', r'\.pem$', r'\.p12$', r'\.pfx$',
    r'\.crt$', r'\.cer$', r'id_rsa', r'id_ed25519', r'\.gpg$', r'\.asc$'
]

BLOCKED_DIRS = [
    'secrets/', '.ssh/', '.gnupg/', '.aws/', 'credentials/', 'certs/', 'keys/', '.git/'
]

class FormatterError(Exception):
    """Custom exception for formatter errors."""
    pass

class SecurityError(Exception):
    """Custom exception for security violations."""
    pass

def validate_file_path(file_path: str) -> None:
    """
    Validate file path for security concerns.
    Raises SecurityError if path is invalid or dangerous.
    """
    if not file_path:
        raise SecurityError("Empty file path provided")
    
    # Normalize path and check for path traversal
    normalized_path = os.path.normpath(file_path)
    if '..' in normalized_path:
        raise SecurityError(f"Path traversal detected: {file_path}")
    
    # Check for blocked patterns
    file_path_lower = file_path.lower()
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, file_path_lower):
            raise SecurityError(f"Blocked file pattern detected: {pattern}")
    
    # Check for blocked directories
    for blocked_dir in BLOCKED_DIRS:
        if blocked_dir in file_path_lower:
            raise SecurityError(f"Blocked directory detected: {blocked_dir}")

def get_file_extension(file_path: str) -> str:
    """Get lowercase file extension."""
    return Path(file_path).suffix.lower()

def check_tool_availability(tool_name: str) -> bool:
    """Check if a formatting tool is available."""
    config = TOOL_CONFIG.get(tool_name)
    if not config:
        return False
        
    try:
        result = subprocess.run(
            config['check_command'],
            shell=True,
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False

def run_formatter(file_path: str, tool_name: str) -> Tuple[bool, str]:
    """
    Run a specific formatter on a file.
    Returns (success, message) tuple.
    """
    config = TOOL_CONFIG[tool_name]
    command = config['command_template'].format(file_path=file_path)
    
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())
        )
        
        if result.returncode == 0:
            return True, f"[OK] {config['name']} formatted {Path(file_path).name}"
        else:
            # Log stderr but don't fail completely
            if result.stderr:
                logger.warning(f"{tool_name} warning: {result.stderr[:200]}")
            return False, f"[WARN] {config['name']} had issues with {Path(file_path).name}"
            
    except subprocess.TimeoutExpired:
        return False, f"[TIMEOUT] {config['name']} timed out on {Path(file_path).name}"
    except subprocess.SubprocessError as e:
        return False, f"[ERROR] {config['name']} error: {str(e)[:100]}"

def get_tools_for_file(file_path: str) -> List[str]:
    """Get list of tools that should process this file."""
    extension = get_file_extension(file_path)
    applicable_tools = []
    
    # Find tools that handle this extension
    for tool_name, config in TOOL_CONFIG.items():
        if extension in config['extensions']:
            applicable_tools.append(tool_name)
    
    # Sort tools to respect dependencies (e.g., prettier before markdownlint)
    ordered_tools = []
    
    # First pass: add tools without dependencies
    for tool in applicable_tools:
        if 'run_after' not in TOOL_CONFIG[tool]:
            ordered_tools.append(tool)
    
    # Second pass: add tools with dependencies
    for tool in applicable_tools:
        if 'run_after' in TOOL_CONFIG[tool]:
            ordered_tools.append(tool)
    
    return ordered_tools

def format_file(file_path: str) -> Dict[str, Union[str, bool, List[str]]]:
    """
    Format a single file with appropriate tools.
    Returns detailed results dictionary.
    """
    results = {
        'file_path': file_path,
        'success': False,
        'messages': [],
        'tools_used': [],
        'errors': []
    }
    
    try:
        # Validate file path for security
        validate_file_path(file_path)
        
        # Check if file exists
        if not os.path.isfile(file_path):
            results['errors'].append(f"File does not exist: {file_path}")
            return results
        
        # Get applicable tools
        tools = get_tools_for_file(file_path)
        if not tools:
            results['messages'].append(f"No formatters configured for {Path(file_path).suffix}")
            results['success'] = True  # Not an error, just no formatters
            return results
        
        # Run each tool
        successful_tools = 0
        for tool_name in tools:
            if not check_tool_availability(tool_name):
                results['messages'].append(f"[WARN] {TOOL_CONFIG[tool_name]['name']} not available")
                continue
                
            success, message = run_formatter(file_path, tool_name)
            results['messages'].append(message)
            results['tools_used'].append(tool_name)
            
            if success:
                successful_tools += 1
        
        # Consider it successful if at least one tool ran successfully
        results['success'] = successful_tools > 0 or len(tools) == 0
        
    except SecurityError as e:
        results['errors'].append(f"Security violation: {str(e)}")
        results['success'] = False
    except Exception as e:
        results['errors'].append(f"Unexpected error: {str(e)}")
        results['success'] = False
    
    return results

def parse_claude_input() -> Optional[str]:
    """Parse JSON input from Claude Code and extract file path."""
    try:
        input_data = json.load(sys.stdin)
        
        # Extract file path from params (Claude sends params, not tool_input)
        params = input_data.get('params', {})
        file_path = params.get('file_path', '')
        
        if not file_path:
            logger.warning("No file_path found in input")
            return None
            
        return file_path
        
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON input: {e}")
        return None
    except Exception as e:
        logger.error(f"Error parsing input: {e}")
        return None

def main():
    """Main execution function."""
    start_time = time.time()

    try:
        # Parse input from Claude Code
        parse_start = time.time()
        file_path = parse_claude_input()
        parse_time = time.time() - parse_start

        if not file_path:
            logger.info(f"Formatting skipped (no file path) - Total: {time.time() - start_time:.3f}s")
            sys.exit(0)  # Exit gracefully for invalid input

        # Format the file
        format_start = time.time()
        results = format_file(file_path)
        format_time = time.time() - format_start

        # Output results
        total_time = time.time() - start_time
        if results['success']:
            for message in results['messages']:
                print(message)

            # Summary for complex operations
            if len(results['tools_used']) > 1:
                print(f"[SUMMARY] Formatted {Path(file_path).name} with {len(results['tools_used'])} tools")

            logger.info(f"Formatting completed for {Path(file_path).name} - Total: {total_time:.3f}s, Parse: {parse_time:.3f}s, Format: {format_time:.3f}s, Tools: {len(results['tools_used'])}")
        else:
            # Print errors to stderr so they don't appear in transcript
            for error in results['errors']:
                print(error, file=sys.stderr)

            logger.warning(f"Formatting failed for {Path(file_path).name} - Total: {total_time:.3f}s, Errors: {len(results['errors'])}")

            # Still exit successfully to avoid breaking Claude's workflow
            sys.exit(0)

    except KeyboardInterrupt:
        print("Formatting interrupted", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        total_time = time.time() - start_time
        logger.error(f"Unexpected error in main after {total_time:.3f}s: {e}")
        sys.exit(0)  # Fail gracefully

if __name__ == '__main__':
    main()