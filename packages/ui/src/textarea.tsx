import * as React from "react";
import { cn } from "@kahade/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
 return (
 <textarea
 className={cn(
 "flex min-h-[100px] w-full rounded-xl border-2 border-border bg-background px-4 py-3",
 "text-[0.9375rem] text-foreground placeholder:text-muted-foreground",
 "transition-all duration-150 resize-y",
 "focus:outline-none focus:border-foreground focus:ring-0",
 "disabled:cursor-not-allowed disabled:opacity-50",
 className
 )}
 {...props}
 />
 );
}

export { Textarea };
