/**
 * Search Page
 * Full-text and semantic search across all conversations
 */

import { SearchInterface } from '@/components/search/search-interface'
import { SearchResults } from '@/components/search/search-results'
import { SearchFilters } from '@/components/search/search-filters'
import { SavedSearches } from '@/components/search/saved-searches'

export default function SearchPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Search</h1>
        <p className="text-slate-600 mt-2">
          Search across all your Claude Code conversations using text or
          semantic similarity
        </p>
      </div>

      {/* Search interface */}
      <SearchInterface />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Search results */}
        <div className="lg:col-span-3">
          <SearchResults />
        </div>

        {/* Search filters and saved searches */}
        <div className="lg:col-span-1 space-y-6">
          <SearchFilters />
          <SavedSearches />
        </div>
      </div>
    </div>
  )
}
