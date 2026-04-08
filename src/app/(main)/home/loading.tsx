import { Skeleton } from "@/components/ui/skeleton";
import { PostSkeleton } from "@/components/post-skeleton";

export default function HomeLoading() {
  return (
    <div className="divide-y divide-border">
      <PostSkeleton />
      <PostSkeleton />
      <PostSkeleton />
    </div>
  );
}