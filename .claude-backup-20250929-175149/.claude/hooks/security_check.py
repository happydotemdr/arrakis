#!/usr/bin/env python3
"""
Advanced security validation hook for Claude Code.
Comprehensive protection against sensitive file modifications and security violations.

Features:
- Multi-layer security validation
- Path traversal protection
- Sensitive file/directory detection
- Configurable security policies
- Detailed threat analysis
- Performance optimized validation
- Clear feedback to Claude
- Extensive logging

Author: Generated for C:\projects workspace
"""

import json
import sys
import os
import re
import time
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Union
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

# Consolidated Security Configuration
# All security rules centralized here instead of duplicating in settings.json
SECURITY_CONFIG = {
    'sensitive_extensions': {
        '.env', '.key', '.pem', '.p12', '.pfx', '.crt', '.cer',
        '.gpg', '.asc', '.keystore', '.jks', '.der', '.csr'
    },
    'sensitive_filenames': {
        'id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa', 'authorized_keys',
        'known_hosts', '.htpasswd', 'shadow', 'passwd', 'master.key',
        'server.key', 'private.key', 'certificate.key', 'settings.local.json'
    },
    'sensitive_patterns': [
        r'.*\.env$', r'.*\.env\..*$', r'.*_key$', r'.*_secret$',
        r'.*password.*', r'.*credential.*', r'.*token.*\.txt$',
        r'.*api[-_]?key.*', r'.*secret[-_]?key.*',
        # Consolidated from settings.json
        r'.*config/credentials\..*$', r'.*\.claude/settings\.local\.json$'
    ],
    'blocked_directories': {
        'secrets/', '.ssh/', '.gnupg/', '.aws/', '.gcp/', '.azure/',
        'credentials/', 'certs/', 'keys/', 'private/', '.git/',
        '.vscode/', 'node_modules/.bin/', 'venv/', '__pycache__/',
        # Additional security-sensitive directories
        'config/credentials/', '.claude/settings.local.json'
    },
    'allowed_exceptions': {
        # Files that might match patterns but are actually safe
        'package.json', 'package-lock.json', 'yarn.lock', '.gitignore',
        'README.md', 'LICENSE', 'CHANGELOG.md', 'CLAUDE.md'
    }
}

class SecurityViolation(Exception):
    """Custom exception for security policy violations."""
    
    def __init__(self, message: str, severity: str = "high", file_path: str = ""):
        self.message = message
        self.severity = severity
        self.file_path = file_path
        super().__init__(self.message)

def normalize_path(file_path: str) -> str:
    """Safely normalize file path."""
    try:
        return os.path.normpath(file_path).replace('\\', '/')
    except Exception:
        return file_path

def check_path_traversal(file_path: str) -> Optional[str]:
    """Check for path traversal attacks."""
    normalized = normalize_path(file_path)
    
    # Check for obvious traversal patterns
    if '..' in normalized:
        return "Path traversal detected with '..'"
    
    # Check for absolute path escapes
    if normalized.startswith('/') and not normalized.startswith(os.getcwd().replace('\\', '/')):
        return "Absolute path outside project detected"
    
    # Check for encoded traversal attempts
    encoded_patterns = ['%2e%2e', '%252e%252e', '..%2f', '..%5c']
    for pattern in encoded_patterns:
        if pattern in file_path.lower():
            return f"Encoded path traversal detected: {pattern}"
    
    return None

def check_sensitive_extension(file_path: str) -> Optional[str]:
    """Check if file has sensitive extension."""
    extension = Path(file_path).suffix.lower()
    
    if extension in SECURITY_CONFIG['sensitive_extensions']:
        return f"Sensitive file extension: {extension}"
    
    return None

def check_sensitive_filename(file_path: str) -> Optional[str]:
    """Check if filename is sensitive."""
    filename = Path(file_path).name.lower()
    
    if filename in SECURITY_CONFIG['sensitive_filenames']:
        return f"Sensitive filename: {filename}"
    
    return None

def check_sensitive_patterns(file_path: str) -> Optional[str]:
    """Check file path against sensitive patterns."""
    path_lower = file_path.lower()
    
    for pattern in SECURITY_CONFIG['sensitive_patterns']:
        if re.search(pattern, path_lower):
            return f"Matches sensitive pattern: {pattern}"
    
    return None

def check_blocked_directories(file_path: str) -> Optional[str]:
    """Check if file is in blocked directory."""
    path_lower = file_path.lower().replace('\\', '/')
    
    for blocked_dir in SECURITY_CONFIG['blocked_directories']:
        if blocked_dir in path_lower:
            return f"File in blocked directory: {blocked_dir}"
    
    return None

def is_allowed_exception(file_path: str) -> bool:
    """Check if file is in allowed exceptions list."""
    filename = Path(file_path).name.lower()
    return filename in SECURITY_CONFIG['allowed_exceptions']

def analyze_file_security(file_path: str) -> Dict[str, Union[str, bool, List[str]]]:
    """
    Comprehensive security analysis of file path.
    Returns detailed security assessment.
    """
    analysis = {
        'file_path': file_path,
        'is_safe': True,
        'violations': [],
        'severity': 'low',
        'recommendation': 'allow'
    }
    
    try:
        # Skip validation for allowed exceptions
        if is_allowed_exception(file_path):
            analysis['recommendation'] = 'allow'
            return analysis
        
        # Run security checks
        checks = [
            check_path_traversal,
            check_sensitive_extension,
            check_sensitive_filename,
            check_sensitive_patterns,
            check_blocked_directories
        ]
        
        high_severity_violations = []
        medium_severity_violations = []
        
        for check_func in checks:
            violation = check_func(file_path)
            if violation:
                analysis['violations'].append(violation)
                analysis['is_safe'] = False
                
                # Classify severity
                if any(term in violation.lower() for term in ['key', 'secret', 'password', 'credential', 'traversal']):
                    high_severity_violations.append(violation)
                else:
                    medium_severity_violations.append(violation)
        
        # Determine overall severity
        if high_severity_violations:
            analysis['severity'] = 'high'
            analysis['recommendation'] = 'block'
        elif medium_severity_violations:
            analysis['severity'] = 'medium'
            analysis['recommendation'] = 'block'
        else:
            analysis['severity'] = 'low'
            analysis['recommendation'] = 'allow'
    
    except Exception as e:
        logger.error(f"Error in security analysis: {e}")
        # Fail secure - block on error
        analysis['is_safe'] = False
        analysis['violations'] = [f"Security analysis error: {str(e)}"]
        analysis['severity'] = 'high'
        analysis['recommendation'] = 'block'
    
    return analysis

def format_security_message(analysis: Dict) -> str:
    """Format security violation message for Claude."""
    file_name = Path(analysis['file_path']).name
    severity_emoji = {'high': '🚨', 'medium': '⚠️', 'low': 'ℹ️'}
    
    message = f"{severity_emoji.get(analysis['severity'], '⚠️')} Security Policy Violation\n"
    message += f"File: {file_name}\n"
    message += f"Severity: {analysis['severity'].upper()}\n"
    
    if analysis['violations']:
        message += "Violations:\n"
        for i, violation in enumerate(analysis['violations'][:3], 1):  # Limit to 3 violations
            message += f"  {i}. {violation}\n"
        
        if len(analysis['violations']) > 3:
            message += f"  ... and {len(analysis['violations']) - 3} more\n"
    
    message += "\n💡 This file appears to contain sensitive information and cannot be modified."
    message += "\nIf this is incorrect, please check your security configuration."
    
    return message.strip()

def parse_claude_input() -> Optional[str]:
    """Parse JSON input from Claude Code and extract file path."""
    try:
        input_data = json.load(sys.stdin)
        
        # Extract file path from tool input
        tool_input = input_data.get('tool_input', {})
        file_path = tool_input.get('file_path', '')
        
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
            # No file path - allow operation to continue
            logger.info(f"Security check skipped (no file path) - Total: {time.time() - start_time:.3f}s")
            sys.exit(0)

        # Perform security analysis
        analysis_start = time.time()
        analysis = analyze_file_security(file_path)
        analysis_time = time.time() - analysis_start

        # Make security decision
        if analysis['recommendation'] == 'block':
            # Format message for Claude
            security_message = format_security_message(analysis)

            # Send message to stderr (Claude will see this)
            print(security_message, file=sys.stderr)

            # Log for debugging
            total_time = time.time() - start_time
            logger.warning(f"Blocked file modification: {file_path} - Total: {total_time:.3f}s, Parse: {parse_time:.3f}s, Analysis: {analysis_time:.3f}s")
            logger.warning(f"Violations: {analysis['violations']}")

            # Exit with code 2 to block operation and provide feedback to Claude
            sys.exit(2)
        else:
            # File is safe - allow operation to proceed
            total_time = time.time() - start_time
            logger.info(f"Security check passed for: {Path(file_path).name} - Total: {total_time:.3f}s, Parse: {parse_time:.3f}s, Analysis: {analysis_time:.3f}s")
            sys.exit(0)

    except KeyboardInterrupt:
        print("Security check interrupted", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        total_time = time.time() - start_time
        logger.error(f"Unexpected error in security check after {total_time:.3f}s: {e}")
        # Fail secure - block operation on unexpected errors
        print(f"Security validation error: {str(e)}", file=sys.stderr)
        sys.exit(2)

if __name__ == '__main__':
    main()