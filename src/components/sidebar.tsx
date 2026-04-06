'use client';

import Link from 'next/link';
import { Home, Compass, Mail, Bell, User, Bookmark, LogOut, UserPlus } from 'lucide-react';
import { NavLink } from '@/components/nav-link';
import { CreatePostButton } from '@/components/create-post-button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  notificationCount?: number;
  messageCount?: number;
  username?: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export function Sidebar({
  notificationCount = 0,
  messageCount = 0,
  username,
  displayName,
  avatarUrl,
}: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[220px] border-r bg-background">
      <div className="flex h-full flex-col">
        <Link
          href="/home"
          className="flex items-center gap-2 p-6 hover:opacity-90 transition-opacity"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
            <span className="text-lg font-bold text-primary-foreground">P</span>
          </div>
          <span className="text-2xl font-bold">Pulse</span>
        </Link>

        <nav className="flex-1 space-y-1 px-3">
          <NavLink href="/home" label="Home" icon={Home} />
          <NavLink href="/search" label="Explore" icon={Compass} />
          <NavLink href="/messages" label="Messages" icon={Mail} badgeCount={messageCount} />
          <NavLink href="/notifications"
            label="Notifications"
            icon={Bell}
            badgeCount={notificationCount}
          />
          <NavLink href="/requests" label="Requests" icon={UserPlus} />
          <NavLink href="/profile" label="Profile" icon={User} />
          <NavLink href="/bookmarks" label="Bookmarks" icon={Bookmark} />
        </nav>

        <div className="space-y-3 border-t p-4">
          <CreatePostButton />

          {username ? (
            <div className="flex items-center gap-3 pt-2">
              <Avatar className="h-10 w-10">
                <AvatarImage src={avatarUrl || undefined} alt={username} />
                <AvatarFallback>{displayName?.[0] ?? 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">@{username}</p>
              </div>
              <form action="/api/auth/logout" method="POST">
                <Button type="submit" variant="ghost" size="icon" className="h-8 w-8">
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button className="w-full">Sign Up</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
