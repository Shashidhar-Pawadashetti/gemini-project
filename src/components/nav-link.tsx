'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavLinkProps {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeCount?: number;
}

export function NavLink({ href, label, icon: Icon, badgeCount }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-4 rounded-full px-4 py-3 text-lg font-medium transition-colors hover:bg-accent',
        isActive && 'bg-accent'
      )}
    >
      <div className="relative">
        <Icon className="h-6 w-6" />
        {badgeCount !== undefined && badgeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </div>
      <span>{label}</span>
    </Link>
  );
}
