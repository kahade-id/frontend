import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "@phosphor-icons/react";
import { cn } from "@kahade/utils";

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
 return (
 <CheckboxPrimitive.Root
 className={cn(
 "peer h-5 w-5 shrink-0 rounded-md border-2 border-border bg-background",
 "transition-all duration-150 cursor-pointer",
 "hover:border-foreground",
 "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
 "disabled:cursor-not-allowed disabled:opacity-50",
 "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
 className
 )}
 {...props}
 >
 <CheckboxPrimitive.Indicator className="flex items-center justify-center text-primary-foreground">
 <Check size={12} weight="bold" />
 </CheckboxPrimitive.Indicator>
 </CheckboxPrimitive.Root>
 );
}

export { Checkbox };
