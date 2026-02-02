import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function Loading() {
  return (
    <div className="page-container py-8">
      <div className="mb-8">
        <div className="h-8 w-56 bg-ink-100 rounded animate-pulse mb-2" />
        <div className="h-4 w-80 bg-ink-100 rounded animate-pulse" />
      </div>

      <div className="card">
        <div className="card-content">
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner className="w-8 h-8 text-rk-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
