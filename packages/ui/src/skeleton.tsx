import { cn } from "@kahade/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
 shimmer?: boolean;
}

function Skeleton({ className, shimmer = false, ...props }: SkeletonProps) {
 return (
 <div
 className={cn("rounded-xl bg-muted", shimmer ? "skeleton-shimmer" : "animate-pulse", className)}
 {...props}
 />
 );
}

function SkeletonCard() {
 return (
 <div className="card p-6 space-y-4">
 <div className="flex items-center gap-3">
 <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
 <div className="space-y-2 flex-1">
 <Skeleton className="h-4 w-2/3" />
 <Skeleton className="h-3 w-1/2" />
 </div>
 </div>
 <Skeleton className="h-32 w-full rounded-xl" />
 <div className="space-y-2">
 <Skeleton className="h-3 w-full" />
 <Skeleton className="h-3 w-4/5" />
 </div>
 </div>
 );
}

function SkeletonTable({ rows = 5 }: { rows?: number }) {
 return (
 <div className="card overflow-hidden">
 <div className="px-5 py-4 border-b border-border bg-muted/30"><Skeleton className="h-8 w-64" /></div>
 <div className="divide-y divide-border">
 {Array.from({ length: rows }).map((_, i) => (
 <div key={i} className="flex items-center gap-4 px-5 py-4">
 <Skeleton className="w-8 h-8 rounded-full shrink-0" />
 <div className="flex-1 space-y-1.5">
 <Skeleton className="h-3.5 w-2/5" />
 <Skeleton className="h-3 w-1/4" />
 </div>
 <Skeleton className="h-3.5 w-20" />
 <Skeleton className="h-6 w-16 rounded-full" />
 </div>
 ))}
 </div>
 </div>
 );
}

function SkeletonMetrics({ count = 4 }: { count?: number }) {
 return (
 <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
 {Array.from({ length: count }).map((_, i) => (
 <div key={i} className="card p-5 space-y-3">
 <Skeleton className="w-10 h-10 rounded-xl" />
 <Skeleton className="h-7 w-24" />
 <Skeleton className="h-3 w-16" />
 </div>
 ))}
 </div>
 );
}

export { Skeleton, SkeletonCard, SkeletonTable, SkeletonMetrics };
