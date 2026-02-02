import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function Loading() {
  return (
    <div className="page-container py-8">
      {/* Back link skeleton */}
      <div className="h-4 w-24 bg-ink-100 rounded animate-pulse mb-6" />

      {/* Header skeleton */}
      <div className="flex items-start gap-6 mb-8">
        <div className="w-24 h-32 bg-ink-100 rounded animate-pulse" />
        <div className="flex-1">
          <div className="h-8 w-48 bg-ink-100 rounded animate-pulse mb-2" />
          <div className="h-5 w-32 bg-ink-100 rounded animate-pulse" />
        </div>
      </div>

      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <LoadingSpinner className="w-10 h-10 mx-auto mb-3 text-rk-500" />
          <p className="text-ink-500 text-sm">Loading MP profile...</p>
        </div>
      </div>
    </div>
  );
}
