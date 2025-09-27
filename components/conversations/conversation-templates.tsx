/**
 * Conversation Templates Component - Phase 6 System A
 * Browse, create, and use conversation templates
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { api } from '@/components/providers/trpc-provider'
import {
  FileText,
  Plus,
  Star,
  Search,
  Edit3,
  Copy,
  Trash2,
  TrendingUp,
  Tag,
  Clock,
  User,
  Globe,
  BookOpen,
  Lightbulb,
  Code,
  Bug,
  Settings,
  Sparkles,
} from 'lucide-react'

interface ConversationTemplatesProps {
  onTemplateSelect?: (template: any) => void
  onClose?: () => void
}

export function ConversationTemplates({
  onTemplateSelect,
  onClose,
}: ConversationTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)

  // Form state for creating/editing templates
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    template: '',
    category: 'general',
    isPublic: false,
  })

  // Fetch templates
  const {
    data: templates,
    isLoading,
    refetch,
  } = api.templates.list.useQuery({
    category: selectedCategory === 'all' ? undefined : selectedCategory,
    search: searchQuery || undefined,
  })

  // Fetch categories
  const { data: categories } = api.templates.categories.useQuery()

  // Fetch popular templates
  const { data: popularTemplates } = api.templates.popular.useQuery({
    limit: 5,
  })

  // Mutations
  const createTemplateMutation = api.templates.create.useMutation({
    onSuccess: () => {
      refetch()
      setIsCreateDialogOpen(false)
      resetForm()
    },
  })

  const updateTemplateMutation = api.templates.update.useMutation({
    onSuccess: () => {
      refetch()
      setIsEditDialogOpen(false)
      setEditingTemplate(null)
      resetForm()
    },
  })

  const deleteTemplateMutation = api.templates.delete.useMutation({
    onSuccess: () => {
      refetch()
    },
  })

  const useTemplateMutation = api.templates.use.useMutation()

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      template: '',
      category: 'general',
      isPublic: false,
    })
  }

  const handleCreateTemplate = async () => {
    try {
      await createTemplateMutation.mutateAsync(formData)
    } catch (error) {
      console.error('Failed to create template:', error)
    }
  }

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return

    try {
      await updateTemplateMutation.mutateAsync({
        id: editingTemplate.id,
        ...formData,
      })
    } catch (error) {
      console.error('Failed to update template:', error)
    }
  }

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      await deleteTemplateMutation.mutateAsync(templateId)
    } catch (error) {
      console.error('Failed to delete template:', error)
    }
  }

  const handleUseTemplate = async (template: any) => {
    try {
      const result = await useTemplateMutation.mutateAsync({
        id: template.id,
        variables: {}, // For now, no variable substitution
      })

      if (onTemplateSelect) {
        onTemplateSelect(result)
      }

      if (onClose) {
        onClose()
      }
    } catch (error) {
      console.error('Failed to use template:', error)
    }
  }

  const startEdit = (template: any) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      description: template.description || '',
      template: template.template,
      category: template.category,
      isPublic: template.isPublic,
    })
    setIsEditDialogOpen(true)
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'debugging':
        return <Bug className="h-4 w-4" />
      case 'development':
        return <Code className="h-4 w-4" />
      case 'learning':
        return <BookOpen className="h-4 w-4" />
      case 'research':
        return <Lightbulb className="h-4 w-4" />
      case 'optimization':
        return <TrendingUp className="h-4 w-4" />
      case 'planning':
        return <Settings className="h-4 w-4" />
      case 'review':
        return <Search className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Conversation Templates
          </h2>
          <p className="text-slate-600 mt-1">
            Quick-start your conversations with pre-built templates
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Template Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Enter template name..."
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="debugging">Debugging</SelectItem>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="learning">Learning</SelectItem>
                      <SelectItem value="research">Research</SelectItem>
                      <SelectItem value="optimization">Optimization</SelectItem>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Description (optional)</Label>
                <Input
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Brief description of the template..."
                />
              </div>

              <div>
                <Label>Template Content</Label>
                <Textarea
                  value={formData.template}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      template: e.target.value,
                    }))
                  }
                  placeholder="Enter your template content here. Use {{variable}} for placeholders..."
                  rows={8}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use {`{{variable}}`} syntax for dynamic placeholders (e.g.,{' '}
                  {`{{component}}`}, {`{{description}}`})
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={formData.isPublic}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isPublic: e.target.checked,
                    }))
                  }
                />
                <Label htmlFor="isPublic" className="text-sm">
                  Make this template public (visible to all users)
                </Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTemplate}
                  disabled={!formData.name || !formData.template}
                >
                  Create Template
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">Browse Templates</TabsTrigger>
          <TabsTrigger value="popular">Popular</TabsTrigger>
          <TabsTrigger value="my-templates">My Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          {/* Search and Filters */}
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.category || 'unknown'} value={cat.category || 'unknown'}>
                    {cat.category || 'Unknown'} ({cat.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates?.map((template) => (
              <Card
                key={template.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(template.category || 'unknown')}
                      <CardTitle className="text-base">
                        {template.name}
                      </CardTitle>
                    </div>
                    <div className="flex items-center space-x-1">
                      {template.isPublic && (
                        <Globe className="h-3 w-3 text-slate-400" />
                      )}
                      <span className="text-xs text-slate-500">
                        {template.usageCount} uses
                      </span>
                    </div>
                  </div>
                  {template.description && (
                    <p className="text-sm text-slate-600 mt-1">
                      {template.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="bg-slate-50 rounded p-3">
                      <p className="text-xs text-slate-700 line-clamp-3">
                        {template.template.substring(0, 150)}...
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUseTemplate(template)}
                        >
                          <Sparkles className="mr-1 h-3 w-3" />
                          Use
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(template)}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTemplate(template.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {templates?.length === 0 && (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-2 text-sm font-medium text-slate-900">
                No templates found
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Create your first template to get started.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="popular" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {popularTemplates?.map((template, index) => (
              <Card
                key={template.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-yellow-100 rounded-full">
                      <span className="text-sm font-semibold text-yellow-600">
                        #{index + 1}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900">
                        {template.name}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">
                        {template.description}
                      </p>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {template.category}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {template.usageCount} uses
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUseTemplate(template)}
                        >
                          <Sparkles className="mr-1 h-3 w-3" />
                          Use
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="my-templates">
          <p className="text-sm text-slate-500">
            My templates functionality coming soon...
          </p>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Template Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="debugging">Debugging</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="learning">Learning</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="optimization">Optimization</SelectItem>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>Template Content</Label>
              <Textarea
                value={formData.template}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, template: e.target.value }))
                }
                rows={8}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateTemplate}>Update Template</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
