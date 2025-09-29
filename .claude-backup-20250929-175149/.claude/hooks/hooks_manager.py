#!/usr/bin/env python3
"""
Claude Code Hooks Management Tool
Advanced configuration and testing utility for Claude Code hooks.

Features:
- Test hooks individually or together
- Validate configurations
- Check tool availability
- Generate hook reports
- Backup and restore configurations
- Troubleshooting utilities

Author: Generated for C:\projects workspace
"""

import json
import sys
import os
import subprocess
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

class HooksManager:
    """Manager for Claude Code hooks configuration and testing."""
    
    def __init__(self, project_dir: str = None):
        self.project_dir = Path(project_dir or os.getcwd())
        self.hooks_dir = self.project_dir / '.claude' / 'hooks'
        self.settings_file = self.project_dir / '.claude' / 'settings.json'
        
    def check_project_structure(self) -> bool:
        """Verify project has proper Claude Code structure."""
        required_paths = [
            self.project_dir / '.claude',
            self.hooks_dir,
            self.settings_file
        ]
        
        missing_paths = [p for p in required_paths if not p.exists()]
        
        if missing_paths:
            print("❌ Missing Claude Code structure:")
            for path in missing_paths:
                print(f"   • {path}")
            return False
        
        print("✅ Claude Code structure is valid")
        return True
    
    def check_tool_availability(self) -> Dict[str, bool]:
        """Check availability of formatting tools."""
        tools = {
            'python': 'py -3 --version',
            'npm': 'npm --version',
            'npx': 'npx --version',
            'biome': 'npx biome --version',
            'prettier': 'npx prettier --version',
            'markdownlint': 'npx markdownlint --version',
            'git': 'git --version'
        }
        
        results = {}
        
        for tool, command in tools.items():
            try:
                result = subprocess.run(
                    command,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                results[tool] = result.returncode == 0
            except (subprocess.TimeoutExpired, subprocess.SubprocessError):
                results[tool] = False
        
        return results
    
    def test_hook_script(self, script_name: str, test_input: Dict) -> Tuple[bool, str]:
        """Test a specific hook script with provided input."""
        script_path = self.hooks_dir / script_name
        
        if not script_path.exists():
            return False, f"Script not found: {script_path}"
        
        try:
            # Prepare test input
            input_json = json.dumps(test_input)
            
            # Run the script using venv Python
            venv_python = Path('C:/projects/.venv/Scripts/python.exe')
            python_cmd = str(venv_python) if venv_python.exists() else 'py -3'

            result = subprocess.run(
                [python_cmd, str(script_path)],
                input=input_json,
                text=True,
                capture_output=True,
                timeout=30,
                cwd=str(self.project_dir),
                env={**os.environ, 'CLAUDE_PROJECT_DIR': str(self.project_dir)}
            )
            
            success = result.returncode == 0
            output = f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
            
            return success, output
            
        except Exception as e:
            return False, f"Error running script: {str(e)}"
    
    def generate_test_inputs(self) -> Dict[str, Dict]:
        """Generate test inputs for different hook types."""
        return {
            'format_files.py': {
                'tool_input': {'file_path': 'test.js'},
                'hook_event_name': 'PostToolUse',
                'tool_name': 'Write'
            },
            'security_check.py': {
                'tool_input': {'file_path': 'test.js'},
                'hook_event_name': 'PreToolUse',
                'tool_name': 'Write'
            },
            'inject_context.py': {
                'prompt': 'What should I work on today?',
                'hook_event_name': 'UserPromptSubmit'
            }
        }
    
    def run_diagnostics(self) -> None:
        """Run comprehensive diagnostics."""
        print("🔍 Running Claude Code Hooks Diagnostics\n")
        
        # Check project structure
        structure_ok = self.check_project_structure()
        print()
        
        # Check tool availability
        print("🛠 Checking Tool Availability:")
        tools = self.check_tool_availability()
        
        for tool, available in tools.items():
            status = "✅" if available else "❌"
            print(f"   {status} {tool}")
        print()
        
        # Test hook scripts
        print("🧪 Testing Hook Scripts:")
        test_inputs = self.generate_test_inputs()
        
        for script_name, test_input in test_inputs.items():
            success, output = self.test_hook_script(script_name, test_input)
            status = "✅" if success else "❌"
            print(f"   {status} {script_name}")
            
            if not success:
                print(f"      Error: {output[:200]}...")
        print()
        
        # Summary
        all_tools_available = all(tools.values())
        all_scripts_working = all(
            self.test_hook_script(script, test_input)[0] 
            for script, test_input in test_inputs.items()
        )
        
        if structure_ok and all_tools_available and all_scripts_working:
            print("🎉 All diagnostics passed! Your hooks are ready to use.")
        else:
            print("⚠️  Some issues were found. Check the details above.")
    
    def validate_settings(self) -> bool:
        """Validate settings.json configuration."""
        try:
            with open(self.settings_file, 'r') as f:
                settings = json.load(f)
            
            print("✅ settings.json is valid JSON")
            
            # Check for required sections
            required_sections = ['permissions', 'hooks']
            for section in required_sections:
                if section in settings:
                    print(f"✅ {section} section found")
                else:
                    print(f"❌ {section} section missing")
                    return False
            
            # Check hook configurations
            hooks = settings.get('hooks', {})
            for hook_type, hook_configs in hooks.items():
                print(f"✅ {hook_type} hook configured")
                
                if isinstance(hook_configs, list):
                    for i, config in enumerate(hook_configs):
                        if 'hooks' in config:
                            for j, hook in enumerate(config['hooks']):
                                if 'command' in hook:
                                    command = hook['command']
                                    if '$CLAUDE_PROJECT_DIR' in command:
                                        print(f"   ✅ Uses $CLAUDE_PROJECT_DIR")
                                    if 'python' in command.lower():
                                        print(f"   ✅ Uses Python script")
            
            return True
            
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON in settings.json: {e}")
            return False
        except Exception as e:
            print(f"❌ Error reading settings.json: {e}")
            return False
    
    def create_backup(self) -> bool:
        """Create backup of current configuration."""
        try:
            import shutil
            from datetime import datetime
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_dir = self.project_dir / '.claude' / f'backup_{timestamp}'
            backup_dir.mkdir(exist_ok=True)
            
            # Backup settings.json
            if self.settings_file.exists():
                shutil.copy2(self.settings_file, backup_dir / 'settings.json')
            
            # Backup hooks directory
            if self.hooks_dir.exists():
                shutil.copytree(self.hooks_dir, backup_dir / 'hooks', dirs_exist_ok=True)
            
            print(f"✅ Backup created: {backup_dir}")
            return True
            
        except Exception as e:
            print(f"❌ Backup failed: {e}")
            return False

def main():
    """Main CLI interface."""
    parser = argparse.ArgumentParser(
        description='Claude Code Hooks Management Tool'
    )
    
    parser.add_argument(
        'command',
        choices=['diagnose', 'validate', 'test', 'backup'],
        help='Command to run'
    )
    
    parser.add_argument(
        '--project-dir', '-p',
        default='.',
        help='Project directory (default: current directory)'
    )
    
    parser.add_argument(
        '--script', '-s',
        help='Specific script to test (for test command)'
    )
    
    args = parser.parse_args()
    
    # Initialize manager
    manager = HooksManager(args.project_dir)
    
    # Execute command
    if args.command == 'diagnose':
        manager.run_diagnostics()
    elif args.command == 'validate':
        manager.validate_settings()
    elif args.command == 'test':
        if args.script:
            test_inputs = manager.generate_test_inputs()
            if args.script in test_inputs:
                success, output = manager.test_hook_script(args.script, test_inputs[args.script])
                print(f"Test result: {'✅ SUCCESS' if success else '❌ FAILED'}")
                print(f"Output:\n{output}")
            else:
                print(f"❌ Unknown script: {args.script}")
        else:
            print("❌ Please specify --script for test command")
    elif args.command == 'backup':
        manager.create_backup()

if __name__ == '__main__':
    main()