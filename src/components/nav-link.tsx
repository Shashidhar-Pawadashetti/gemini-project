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
        'flex items-center gap-3 md:gap-4 rounded-full px-3 md:px-4 py-2 md:py-3 text-base md:text-lg font-medium transition-colors hover:bg-accent',
        isActive && 'bg-accent'
      )}
    >
      <div className="relative">
        <Icon className="h-5 w-5 md:h-6 md:w-6" />
        {badgeCount !== undefined && badgeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 md:h-5 md:w-5 items-center justify-center rounded-full bg-primary text-[10px] md:text-xs font-medium text-primary-foreground">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </div>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
