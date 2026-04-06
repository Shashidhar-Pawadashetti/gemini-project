import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function WhoToFollowCard() {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Who to follow</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        ))}
        <Button variant="link" className="w-full text-primary p-0 h-auto">
          Show more
        </Button>
      </CardContent>
    </Card>
  );
}

function TrendingCard() {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Trending</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-1">
            <p className="font-medium">#Topic{i}</p>
            <p className="text-sm text-muted-foreground">{Math.floor(Math.random() * 1000)} posts</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Footer() {
  const links = [
    { label: 'Terms', href: '/terms' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'Cookies', href: '/cookies' },
    { label: 'About', href: '/about' },
  ];

  return (
    <div className="text-xs text-muted-foreground px-4">
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        {links.map((link) => (
          <a key={link.href} href={link.href} className="hover:underline">
            {link.label}
          </a>
        ))}
      </div>
      <p className="mt-2">© 2026 Pulse</p>
    </div>
  );
}

export function RightSidebar() {
  return (
    <aside className="sticky top-0 h-screen overflow-y-auto px-4 py-4">
      <WhoToFollowCard />
      <TrendingCard />
      <Footer />
    </aside>
  );
}
