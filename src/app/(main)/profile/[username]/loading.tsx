import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="space-y-4 p-4">
      <div className="relative">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="absolute -bottom-10 left-4 h-20 w-20 rounded-full border-4 border-background" />
      </div>
      <div className="pt-12 space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex gap-6 pt-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="border-t">
        <div className="flex border-b">
          <div className="flex-1 p-4 text-center">
            <Skeleton className="h-4 w-8 mx-auto" />
            <Skeleton className="h-3 w-12 mx-auto mt-1" />
          </div>
          <div className="flex-1 p-4 text-center">
            <Skeleton className="h-4 w-8 mx-auto" />
            <Skeleton className="h-3 w-12 mx-auto mt-1" />
          </div>
          <div className="flex-1 p-4 text-center">
            <Skeleton className="h-4 w-8 mx-auto" />
            <Skeleton className="h-3 w-12 mx-auto mt-1" />
          </div>
        </div>
      </div>
    </div>
  );
}