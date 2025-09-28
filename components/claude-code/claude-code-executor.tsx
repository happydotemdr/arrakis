/**
 * Claude Code Task Executor Component
 * Interface for executing Claude Code tasks (System B of dual strategy)
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Play,
  Square,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Brain,
  Code2,
  Zap
} from 'lucide-react'
import { api } from '@/components/providers/trpc-provider'

interface TaskTemplate {
  id: string
  name: string
  description: string
  category: 'analysis' | 'improvement' | 'feature' | 'maintenance' | 'testing'
  estimatedDuration: number
}

export function ClaudeCodeExecutor() {
  const [activeTab, setActiveTab] = useState('templates')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [currentSession, setCurrentSession] = useState<string | null>(null)

  // Fetch available templates
  const { data: templatesData, isLoading: templatesLoading } = api.claudeCode.getTemplates.useQuery()

  // Fetch system status
  const { data: statusData, refetch: refetchStatus } = api.claudeCode.getStatus.useQuery()

  // Mutations
  const executeTaskMutation = api.claudeCode.executeTask.useMutation({
    onSuccess: (data: any) => {
      setCurrentSession(data.sessionId)
      console.log(`Task Started: Claude Code task "${data.task.title}" has been started.`)
    },
    onError: (error: any) => {
      console.error('Execution Failed:', error.message)
      setIsExecuting(false)
    }
  })

  const executeCustomTaskMutation = api.claudeCode.executeCustomTask.useMutation({
    onSuccess: (data: any) => {
      setCurrentSession(data.sessionId)
      console.log(`Custom Task Started: Claude Code task "${data.task.title}" has been started.`)
    },
    onError: (error: any) => {
      console.error('Execution Failed:', error.message)
      setIsExecuting(false)
    }
  })

  const executeDemoMutation = api.claudeCode.executeDemo.useMutation({
    onSuccess: (data: any) => {
      setCurrentSession(data.sessionId)
      console.log(`Demo Started: ${data.message}`)
    },
    onError: (error: any) => {
      console.error('Demo Failed:', error.message)
      setIsExecuting(false)
    }
  })

  const templates = templatesData?.templates || []

  const handleExecuteTemplate = async () => {
    if (!selectedTemplate) {
      console.warn('No Template Selected: Please select a task template to execute.')
      return
    }

    setIsExecuting(true)
    await executeTaskMutation.mutateAsync({
      templateId: selectedTemplate,
      customPrompt: customPrompt || undefined
    })
  }

  const handleExecuteCustom = async () => {
    if (!customTitle.trim() || !customPrompt.trim()) {
      console.warn('Missing Information: Please provide both a title and prompt for the custom task.')
      return
    }

    setIsExecuting(true)
    await executeCustomTaskMutation.mutateAsync({
      title: customTitle,
      prompt: customPrompt
    })
  }

  const handleExecuteDemo = async () => {
    setIsExecuting(true)
    await executeDemoMutation.mutateAsync()
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'analysis': return <Brain className="h-4 w-4" />
      case 'improvement': return <Zap className="h-4 w-4" />
      case 'feature': return <Code2 className="h-4 w-4" />
      case 'maintenance': return <CheckCircle className="h-4 w-4" />
      case 'testing': return <Play className="h-4 w-4" />
      default: return <Code2 className="h-4 w-4" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'analysis': return 'bg-blue-100 text-blue-800'
      case 'improvement': return 'bg-green-100 text-green-800'
      case 'feature': return 'bg-purple-100 text-purple-800'
      case 'maintenance': return 'bg-yellow-100 text-yellow-800'
      case 'testing': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (templatesLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading Claude Code interface...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="mr-2 h-5 w-5" />
            Claude Code System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Claude CLI</span>
              <Badge variant={statusData?.status.claudeCliAvailable ? 'default' : 'destructive'}>
                {statusData?.status.claudeCliAvailable ? 'Available' : 'Not Found'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">System Ready</span>
              <Badge variant={statusData?.status.systemReady ? 'default' : 'destructive'}>
                {statusData?.status.systemReady ? 'Ready' : 'Not Ready'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Running Sessions</span>
              <span className="text-sm">{statusData?.status.runningSessions || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Templates</span>
              <span className="text-sm">{statusData?.status.availableTemplates || 0}</span>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs text-blue-800 space-y-1">
              <div className="font-medium">System Status Indicators:</div>
              <div>• <strong>Claude CLI:</strong> Claude Code command-line interface availability</div>
              <div>• <strong>System Ready:</strong> All components operational for task execution</div>
              <div>• <strong>Running Sessions:</strong> Active Claude Code tasks in progress</div>
              <div>• <strong>Templates:</strong> Available pre-configured task templates</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Execution Interface */}
      <Card>
        <CardHeader>
          <CardTitle>Execute Claude Code Task</CardTitle>
          <p className="text-sm text-muted-foreground">
            System B: Claude Code with full tool access - can read, write, edit files and run commands
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="templates">Task Templates</TabsTrigger>
              <TabsTrigger value="custom">Custom Task</TabsTrigger>
              <TabsTrigger value="demo">Quick Demo</TabsTrigger>
            </TabsList>

            <TabsContent value="templates" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="template-select">Select Task Template</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a task template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template: any) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center space-x-2">
                            {getCategoryIcon(template.category)}
                            <span>{template.name}</span>
                            <Badge className={getCategoryColor(template.category)}>
                              {template.category}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTemplate && (
                  <div className="space-y-2">
                    {(() => {
                      const template = templates.find((t: any) => t.id === selectedTemplate)
                      return template ? (
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{template.name}</h4>
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4" />
                              <span className="text-sm">{template.estimatedDuration} min</span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        </div>
                      ) : null
                    })()}
                  </div>
                )}

                <div>
                  <Label htmlFor="custom-prompt">Custom Instructions (Optional)</Label>
                  <Textarea
                    id="custom-prompt"
                    placeholder="Add any specific instructions or modifications to the template..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button
                  onClick={handleExecuteTemplate}
                  disabled={!selectedTemplate || isExecuting || !statusData?.status.systemReady}
                  className="w-full"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Execute Template
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="custom" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="custom-title">Task Title</Label>
                  <input
                    id="custom-title"
                    type="text"
                    placeholder="Enter a descriptive title for your task..."
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md"
                  />
                </div>

                <div>
                  <Label htmlFor="custom-task-prompt">Task Prompt</Label>
                  <Textarea
                    id="custom-task-prompt"
                    placeholder="Describe what you want Claude Code to do. Be specific about the task, requirements, and expectations..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={8}
                  />
                </div>

                <Button
                  onClick={handleExecuteCustom}
                  disabled={!customTitle.trim() || !customPrompt.trim() || isExecuting || !statusData?.status.systemReady}
                  className="w-full"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Execute Custom Task
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="demo" className="space-y-4">
              <div className="text-center space-y-4">
                <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
                  <h3 className="text-lg font-semibold mb-2">Claude Code Capabilities Demo</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    This demo will showcase the full capabilities of Claude Code (System B) by having it:
                  </p>
                  <ul className="text-sm space-y-1 text-left max-w-md mx-auto">
                    <li>• Read and analyze the codebase</li>
                    <li>• Run commands to check the current state</li>
                    <li>• Make a meaningful improvement</li>
                    <li>• Verify the changes work correctly</li>
                  </ul>
                </div>

                <Button
                  onClick={handleExecuteDemo}
                  disabled={isExecuting || !statusData?.status.systemReady}
                  size="lg"
                  className="w-full"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Running Demo...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-5 w-5" />
                      Start Capabilities Demo
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Current Session Info */}
      {currentSession && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Active Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Session ID</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">{currentSession}</code>
              </div>
              <p className="text-sm text-muted-foreground">
                Task is running in the background. Check the Sessions page for real-time updates.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}