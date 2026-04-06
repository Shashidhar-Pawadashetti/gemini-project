'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { SearchInput } from './search-input';
import { SearchResults } from './search-results';
import { SearchTabs } from './search-tabs';
import type { Profile, Post, SearchResponse } from '@/types';

type SearchType = 'all' | 'users' | 'posts' | 'tags';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');
  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', debouncedQuery, searchType],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return null;
      
      const params = new URLSearchParams({
        q: debouncedQuery,
        type: searchType,
      });
      
      const response = await fetch(`/api/search?${params}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json() as Promise<SearchResponse>;
    },
    enabled: debouncedQuery.length >= 2,
  });

  return (
    <div>
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <SearchInput value={query} onChange={setQuery} />
        <SearchTabs value={searchType} onChange={setSearchType} />
      </div>

      <SearchResults
        data={data ?? null}
        isLoading={isLoading}
        isError={isError}
        query={debouncedQuery}
        searchType={searchType}
      />
    </div>
  );
}
