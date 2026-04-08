import { Sidebar } from '@/components/sidebar';
import { RightSidebar } from '@/components/right-sidebar';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-0 md:pl-[220px]">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">
          <main className="min-h-screen border-x">
            {children}
          </main>
          <div className="hidden lg:block">
            <RightSidebar />
          </div>
        </div>
      </div>
    </div>
  );
}
