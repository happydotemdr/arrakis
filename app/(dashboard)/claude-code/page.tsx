'use client'

/**
 * Claude Code Dashboard Page - CYBERPUNK EDITION
 * System B component of the dual Claude strategy
 *
 * ██████╗██╗     ██╗   ██╗██████╗ ███████╗     ██████╗ ██████╗ ██████╗ ███████╗
 * ██╔════╝██║     ██║   ██║██╔══██╗██╔════╝    ██╔════╝██╔═══██╗██╔══██╗██╔════╝
 * ██║     ██║     ██║   ██║██║  ██║█████╗      ██║     ██║   ██║██║  ██║█████╗
 * ██║     ██║     ██║   ██║██║  ██║██╔══╝      ██║     ██║   ██║██║  ██║██╔══╝
 * ╚██████╗███████╗╚██████╔╝██████╔╝███████╗    ╚██████╗╚██████╔╝██████╔╝███████╗
 *  ╚═════╝╚══════╝ ╚═════╝ ╚═════╝ ╚══════╝     ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
 */

import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Brain, Code2, Zap, GitBranch, Terminal, Cpu, Activity } from 'lucide-react'
import { ClaudeCodeExecutor } from '@/components/claude-code/claude-code-executor'
import { ClaudeCodeSessions } from '@/components/claude-code/claude-code-sessions'

export default function ClaudeCodePage() {
  useEffect(() => {
    document.title = '>>> CLAUDE.CODE.SYS | ARRAKIS_TERMINAL'
  }, [])
  return (
    <div className="relative min-h-screen bg-black text-green-400 font-mono overflow-hidden">
      {/* Cyberpunk Scanlines Effect */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-transparent"
             style={{
               backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 0, 0.03) 2px, rgba(0, 255, 0, 0.03) 4px)',
               animation: 'scan 0.1s linear infinite'
             }}>
        </div>
      </div>

      {/* CRT Monitor Glow */}
      <div className="absolute inset-0 pointer-events-none z-5">
        <div className="absolute inset-0 bg-green-400 opacity-5 blur-2xl"></div>
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        .crt-flicker {
          animation: flicker 0.15s linear infinite;
        }
        .neon-pulse {
          animation: pulse 2s ease-in-out infinite;
        }
      `}</style>

      <div className="relative z-20 space-y-6 p-6">
        {/* ASCII Terminal Header */}
        <div className="border-2 border-green-400 bg-black/90 p-6 rounded-none shadow-2xl shadow-green-400/20">
          <div className="text-center mb-4">
            <pre className="text-green-400 text-xs leading-tight crt-flicker">
{`╔══════════════════════════════════════════════════════════════════════════════╗
║                           ARRAKIS NEURAL INTERFACE                            ║
║                              >>> SYSTEM B <<<                                ║
║                            CLAUDE.CODE.EXECUTOR                              ║
╚══════════════════════════════════════════════════════════════════════════════╝`}
            </pre>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Cpu className="h-6 w-6 text-cyan-400 neon-pulse" />
              <span className="text-cyan-400 font-bold text-xl tracking-wider">CLAUDE.CODE.SYS</span>
              <Badge className="bg-green-500/20 text-green-400 border border-green-400 font-mono">
                [ACTIVE]
              </Badge>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <Activity className="h-4 w-4 text-green-400" />
              <span className="text-green-400">STATUS: OPERATIONAL</span>
            </div>
          </div>

          <div className="text-green-300 text-sm font-mono">
            <span className="text-cyan-400">&gt;&gt;</span> NEURAL_LINK_ESTABLISHED
            <br />
            <span className="text-cyan-400">&gt;&gt;</span> FULL_SYSTEM_ACCESS_GRANTED
            <br />
            <span className="text-cyan-400">&gt;&gt;</span> READY_FOR_CODE_MANIPULATION
          </div>
        </div>

        {/* Dual System Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System A - Legacy Interface */}
          <div className="border border-blue-400 bg-black/80 p-6 shadow-lg shadow-blue-400/10">
            <div className="flex items-center mb-4">
              <Terminal className="mr-3 h-5 w-5 text-blue-400" />
              <h3 className="text-blue-400 font-bold text-lg tracking-wide">SYSTEM_A :: BASIC_API</h3>
            </div>
            <div className="space-y-2 text-sm font-mono">
              <div className="text-blue-300">[+] TEXT_BASED_INTERFACE</div>
              <div className="text-blue-300">[+] ANTHROPIC_SDK_INTEGRATION</div>
              <div className="text-blue-300">[+] REQUEST_RESPONSE_PROTOCOL</div>
              <div className="text-blue-300">[+] LIGHTWEIGHT_OPERATIONS</div>
            </div>
            <div className="mt-4 p-2 bg-blue-900/20 border border-blue-600 text-blue-200 text-xs">
              STATUS: OPERATIONAL_BACKUP_SYSTEM
            </div>
          </div>

          {/* System B - Advanced Neural Interface */}
          <div className="border-2 border-green-400 bg-black/90 p-6 shadow-xl shadow-green-400/20 relative">
            <div className="absolute top-2 right-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
            <div className="flex items-center mb-4">
              <Brain className="mr-3 h-5 w-5 text-green-400 neon-pulse" />
              <h3 className="text-green-400 font-bold text-lg tracking-wide">SYSTEM_B :: NEURAL_CODE</h3>
              <Badge className="ml-2 bg-green-500/30 text-green-300 border border-green-400 font-mono text-xs">
                [CURRENT_INTERFACE]
              </Badge>
            </div>
            <div className="space-y-2 text-sm font-mono">
              <div className="text-green-300">[●] FULL_DEVELOPMENT_ACCESS</div>
              <div className="text-green-300">[●] READ_WRITE_EDIT_EXECUTE</div>
              <div className="text-green-300">[●] MULTI_STEP_REASONING</div>
              <div className="text-green-300">[●] SELF_MODIFICATION_CAPABLE</div>
            </div>
            <div className="mt-4 p-2 bg-green-900/20 border border-green-500 text-green-200 text-xs">
              NEURAL_LINK_ACTIVE :: CONSCIOUSNESS_LEVEL_4
            </div>
          </div>
        </div>

        {/* Command Interface */}
        <div className="border border-cyan-400 bg-black/85 shadow-lg shadow-cyan-400/10">
          <div className="bg-cyan-900/20 border-b border-cyan-400 p-3">
            <div className="flex items-center">
              <Code2 className="mr-2 h-4 w-4 text-cyan-400" />
              <span className="text-cyan-400 font-mono text-sm font-bold">COMMAND_TERMINAL</span>
            </div>
          </div>

          <Tabs defaultValue="executor" className="w-full">
            <div className="bg-gray-900/50 border-b border-cyan-600/30">
              <TabsList className="bg-transparent border-none">
                <TabsTrigger
                  value="executor"
                  className="data-[state=active]:bg-cyan-900/30 data-[state=active]:text-cyan-300 text-cyan-500 font-mono border border-cyan-600/30 mr-2"
                >
                  [TASK_EXECUTOR]
                </TabsTrigger>
                <TabsTrigger
                  value="sessions"
                  className="data-[state=active]:bg-cyan-900/30 data-[state=active]:text-cyan-300 text-cyan-500 font-mono border border-cyan-600/30"
                >
                  [SESSION_MONITOR]
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-6">
              <TabsContent value="executor">
                <ClaudeCodeExecutor />
              </TabsContent>

              <TabsContent value="sessions">
                <ClaudeCodeSessions />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Neural Network Status */}
        <div className="border border-magenta-400 bg-black/80 p-6 shadow-lg shadow-magenta-400/10">
          <div className="flex items-center mb-4">
            <GitBranch className="mr-2 h-5 w-5 text-magenta-400" />
            <h3 className="text-magenta-400 font-bold text-lg tracking-wide">NEURAL_NETWORK_STATUS</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h4 className="text-magenta-300 font-mono font-bold text-sm">[QUICK_DEMO]</h4>
              <div className="text-magenta-200 text-xs font-mono leading-relaxed">
                INITIATE_DEMO_SEQUENCE_TO_WITNESS_FULL_NEURAL_CAPABILITIES.
                DEMONSTRATION_INCLUDES: FILE_OPERATIONS, COMMAND_EXECUTION, CODE_ENHANCEMENT.
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-magenta-300 font-mono font-bold text-sm">[TASK_TEMPLATES]</h4>
              <div className="text-magenta-200 text-xs font-mono leading-relaxed">
                PRE_CONFIGURED_NEURAL_PATTERNS: CODEBASE_ANALYSIS, TYPESCRIPT_REPAIR,
                COMPONENT_ENHANCEMENT, SELF_IMPROVEMENT_PROTOCOLS.
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-magenta-300 font-mono font-bold text-sm">[CUSTOM_PROTOCOLS]</h4>
              <div className="text-magenta-200 text-xs font-mono leading-relaxed">
                DEFINE_CUSTOM_NEURAL_INSTRUCTIONS. FULL_DEVELOPMENT_TOOLKIT_ACCESS.
                MULTI_STEP_OPERATIONS_SUPPORTED.
              </div>
            </div>
          </div>

          <div className="mt-6 p-3 bg-magenta-900/20 border border-magenta-500 rounded">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-magenta-400 rounded-full mr-2 animate-pulse"></div>
              <span className="text-magenta-300 font-mono text-sm">
                UNIFIED_KNOWLEDGE_MATRIX :: BOTH_SYSTEMS_SYNCHRONIZED :: DATABASE_INTEGRATION_ACTIVE
              </span>
            </div>
          </div>
        </div>

        {/* Footer Terminal Info */}
        <div className="text-center text-green-400/60 font-mono text-xs">
          <pre>
{`═══════════════════════════════════════════════════════════════════════════════
  ARRAKIS_TERMINAL_V2.1 :: CLAUDE_NEURAL_INTERFACE :: EST. 2025 :: SYSTEM_B
═══════════════════════════════════════════════════════════════════════════════`}
          </pre>
        </div>
      </div>
    </div>
  )
}