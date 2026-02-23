import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@kahade/utils";

function Progress({
 className,
 value,
 ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
 return (
 <ProgressPrimitive.Root
 data-slot="progress"
 className={cn(
 "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
 className
 )}
 {...props}
 >
 <ProgressPrimitive.Indicator
 data-slot="progress-indicator"
 className="bg-primary h-full w-full flex-1 transition-all focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
 style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
 />
 </ProgressPrimitive.Root>
 );
}

export { Progress };
