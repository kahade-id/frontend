import { cn } from "@kahade/utils";

interface SpinnerProps {
 size?: "xs" | "sm" | "md" | "lg";
 className?: string;
}

const sizeMap = { xs: "w-3 h-3", sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" };

export function Spinner({ size = "md", className }: SpinnerProps) {
 return (
 <div
 className={cn(
 "rounded-full border-2 border-current border-t-transparent animate-spin",
 sizeMap[size],
 className
 )}
 role="status"
 aria-label="Loading"
 />
 );
}
