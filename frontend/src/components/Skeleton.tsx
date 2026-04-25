interface SkeletonProps {
  height?: string;
  width?: string;
  className?: string;
}

/**
 * Loading skeleton placeholder.
 */
export function Skeleton({ height = "h-8", width = "w-full", className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-sm bg-slate-100 ${height} ${width} ${className}`}
    />
  );
}

/**
 * Multi-line skeleton loader for content areas.
 */
export function SkeletonGroup({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={i === 0 ? "h-6" : i === lines - 1 ? "h-64" : "h-32"}
          width={i === 0 ? "w-40" : "w-full"}
        />
      ))}
    </div>
  );
}
