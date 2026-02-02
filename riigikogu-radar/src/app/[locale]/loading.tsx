import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function Loading() {
  return (
    <div className="page-container py-12">
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <LoadingSpinner className="w-12 h-12 mx-auto mb-4 text-rk-500" />
          <p className="text-ink-500">Loading...</p>
        </div>
      </div>
    </div>
  );
}
