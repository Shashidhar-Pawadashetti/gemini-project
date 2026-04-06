'use client';

import { Search, Users, FileText, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

type SearchType = 'all' | 'users' | 'posts' | 'tags';

interface SearchTabsProps {
  value: SearchType;
  onChange: (value: SearchType) => void;
}

const tabs: { value: SearchType; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'Top', icon: <Search className="h-4 w-4" /> },
  { value: 'users', label: 'People', icon: <Users className="h-4 w-4" /> },
  { value: 'posts', label: 'Posts', icon: <FileText className="h-4 w-4" /> },
  { value: 'tags', label: 'Tags', icon: <Hash className="h-4 w-4" /> },
];

export function SearchTabs({ value, onChange }: SearchTabsProps) {
  return (
    <div className="flex mt-3 border-b">
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
            value === tab.value
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:bg-accent'
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
