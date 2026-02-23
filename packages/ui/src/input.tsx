import * as React from "react";
import { cn } from "@kahade/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
 return (
 <input
 type={type}
 className={cn(
 "flex h-12 w-full rounded-xl border-2 border-border bg-background px-4",
 "text-[0.9375rem] text-foreground placeholder:text-muted-foreground",
 "transition-all duration-150",
 "focus:outline-none focus:border-foreground focus:ring-0",
 "disabled:cursor-not-allowed disabled:opacity-50",
 "file:border-0 file:bg-transparent file:text-sm file:font-medium",
 className
 )}
 {...props}
 />
 );
}

export { Input };
