import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@kahade/utils";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
 return (
 <SwitchPrimitive.Root
 className={cn(
 "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent",
 "cursor-pointer transition-colors duration-200",
 "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
 "disabled:cursor-not-allowed disabled:opacity-50",
 "data-[state=checked]:bg-primary data-[state=unchecked]:bg-neutral-300 dark:data-[state=unchecked]:bg-neutral-600",
 className
 )}
 {...props}
 >
 <SwitchPrimitive.Thumb
 className={cn(
 "pointer-events-none block h-4 w-4 rounded-full bg-white ",
 "ring-0 transition-transform duration-200",
 "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
 )}
 />
 </SwitchPrimitive.Root>
 );
}

export { Switch };
