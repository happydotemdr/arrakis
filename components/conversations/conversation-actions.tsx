/**
 * Conversation Actions Component - Phase 6 System A
 * Bulk operations for selected conversations (export, tag, delete, etc.)
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { api } from '@/components/providers/trpc-provider'
import {
  Download,
  Tag,
  Trash2,
  Copy,
  Share,
  Archive,
  Star,
  FileText,
  FileJson,
  FileImage,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react'

interface ConversationActionsProps {
  selectedConversations: string[]
  onActionComplete: () => void
}

export function ConversationActions({
  selectedConversations,
  onActionComplete,
}: ConversationActionsProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportFormat, setExportFormat] = useState<'json' | 'markdown' | 'pdf'>(
    'json'
  )
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')

  // Mock available tags - in real app, would come from API
  const availableTags = [
    { id: 1, name: 'debugging', color: '#ef4444' },
    { id: 2, name: 'development', color: '#10b981' },
    { id: 3, name: 'learning', color: '#3b82f6' },
    { id: 4, name: 'research', color: '#8b5cf6' },
    { id: 5, name: 'optimization', color: '#f59e0b' },
    { id: 6, name: 'planning', color: '#06b6d4' },
    { id: 7, name: 'review', color: '#ec4899' },
  ]

  const handleExport = async () => {
    setIsExporting(true)
    setExportProgress(0)

    try {
      // Simulate export progress
      const progressInterval = setInterval(() => {
        setExportProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      // In real app, this would call the export API
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Mock API call
      // const result = await api.sessions.export.mutate({
      //   sessionIds: selectedConversations,
      //   format: exportFormat
      // })

      clearInterval(progressInterval)
      setExportProgress(100)

      // Simulate download
      const mockData = {
        conversations: selectedConversations.map((id) => ({
          id,
          title: `Conversation ${id}`,
          messages: ['Mock message data'],
          metadata: { exported: new Date() },
        })),
        exportedAt: new Date(),
        format: exportFormat,
        count: selectedConversations.length,
      }

      const blob = new Blob([JSON.stringify(mockData, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `arrakis-conversations-${Date.now()}.${exportFormat}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setTimeout(() => {
        setIsExporting(false)
        setExportProgress(0)
        onActionComplete()
      }, 1000)
    } catch (error) {
      console.error('Export failed:', error)
      setIsExporting(false)
      setExportProgress(0)
    }
  }

  const handleAddTag = async (tagName: string) => {
    try {
      // In real app, this would add tags to selected conversations
      console.log(
        `Adding tag "${tagName}" to conversations:`,
        selectedConversations
      )

      // Mock API call
      // await api.sessions.addTags.mutate({
      //   sessionIds: selectedConversations,
      //   tagName
      // })

      onActionComplete()
    } catch (error) {
      console.error('Failed to add tag:', error)
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return

    try {
      // In real app, this would create a new tag and apply it
      console.log(
        `Creating and applying tag "${newTagName}" with color ${newTagColor}`
      )

      // Mock API call
      // await api.tags.create.mutate({
      //   name: newTagName,
      //   color: newTagColor
      // })

      await handleAddTag(newTagName)
      setNewTagName('')
      setIsTagDialogOpen(false)
    } catch (error) {
      console.error('Failed to create tag:', error)
    }
  }

  const handleBulkDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete ${selectedConversations.length} conversations? This action cannot be undone.`
      )
    ) {
      return
    }

    try {
      // In real app, this would delete the conversations
      console.log('Deleting conversations:', selectedConversations)

      // Mock API call
      // await api.sessions.bulkDelete.mutate({
      //   sessionIds: selectedConversations
      // })

      onActionComplete()
    } catch (error) {
      console.error('Failed to delete conversations:', error)
    }
  }

  const handleArchive = async () => {
    try {
      // In real app, this would archive the conversations
      console.log('Archiving conversations:', selectedConversations)

      // Mock API call
      // await api.sessions.bulkArchive.mutate({
      //   sessionIds: selectedConversations
      // })

      onActionComplete()
    } catch (error) {
      console.error('Failed to archive conversations:', error)
    }
  }

  const handleFavorite = async () => {
    try {
      // In real app, this would favorite the conversations
      console.log('Favoriting conversations:', selectedConversations)

      // Mock API call
      // await api.sessions.bulkFavorite.mutate({
      //   sessionIds: selectedConversations
      // })

      onActionComplete()
    } catch (error) {
      console.error('Failed to favorite conversations:', error)
    }
  }

  return (
    <div className="flex items-center space-x-2">
      <Badge variant="secondary" className="text-sm">
        {selectedConversations.length} selected
      </Badge>

      <Separator orientation="vertical" className="h-6" />

      {/* Export Dialog */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Conversations</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Export Format</Label>
              <Select
                value={exportFormat}
                onValueChange={(value) => setExportFormat(value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">
                    <div className="flex items-center">
                      <FileJson className="mr-2 h-4 w-4" />
                      JSON (with metadata)
                    </div>
                  </SelectItem>
                  <SelectItem value="markdown">
                    <div className="flex items-center">
                      <FileText className="mr-2 h-4 w-4" />
                      Markdown (readable)
                    </div>
                  </SelectItem>
                  <SelectItem value="pdf">
                    <div className="flex items-center">
                      <FileImage className="mr-2 h-4 w-4" />
                      PDF (formatted)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isExporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Exporting conversations...</span>
                  <span>{exportProgress}%</span>
                </div>
                <Progress value={exportProgress} />
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" disabled={isExporting}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export {selectedConversations.length} conversations
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tag Dialog */}
      <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Tag className="mr-2 h-4 w-4" />
            Tag
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tags to Conversations</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing Tags */}
            <div>
              <Label className="text-sm font-medium">Existing Tags</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {availableTags.map((tag) => (
                  <Button
                    key={tag.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddTag(tag.name)}
                    className="justify-start h-auto p-2"
                  >
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Create New Tag */}
            <div>
              <Label className="text-sm font-medium">Create New Tag</Label>
              <div className="space-y-3 mt-2">
                <div>
                  <Label className="text-xs">Tag Name</Label>
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Enter tag name..."
                  />
                </div>
                <div>
                  <Label className="text-xs">Color</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="w-16 h-8 p-1"
                    />
                    <span className="text-sm text-slate-500">
                      {newTagColor}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                  className="w-full"
                  size="sm"
                >
                  <Tag className="mr-2 h-4 w-4" />
                  Create & Apply Tag
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Separator orientation="vertical" className="h-6" />

      {/* Quick Actions */}
      <Button variant="outline" size="sm" onClick={handleFavorite}>
        <Star className="mr-2 h-4 w-4" />
        Favorite
      </Button>

      <Button variant="outline" size="sm" onClick={handleArchive}>
        <Archive className="mr-2 h-4 w-4" />
        Archive
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          navigator.clipboard.writeText(selectedConversations.join('\n'))
        }
      >
        <Copy className="mr-2 h-4 w-4" />
        Copy IDs
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {/* Destructive Actions */}
      <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>
    </div>
  )
}
