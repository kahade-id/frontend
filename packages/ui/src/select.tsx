import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CaretDown, CaretUp, Check } from "@phosphor-icons/react";
import { cn } from "@kahade/utils";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
 return (
 <SelectPrimitive.Trigger
 className={cn(
 "flex h-12 w-full items-center justify-between rounded-xl border-2 border-border bg-background px-4",
 "text-[0.9375rem] text-foreground placeholder:text-muted-foreground",
 "transition-all duration-150 cursor-pointer",
 "focus:outline-none focus:border-foreground",
 "disabled:cursor-not-allowed disabled:opacity-50",
 "[&>span]:line-clamp-1",
 className
 )}
 {...props}
 >
 {children}
 <SelectPrimitive.Icon asChild>
 <CaretDown size={16} className="text-muted-foreground shrink-0" />
 </SelectPrimitive.Icon>
 </SelectPrimitive.Trigger>
 );
}

function SelectContent({ className, children, position = "popper", ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
 return (
 <SelectPrimitive.Portal>
 <SelectPrimitive.Content
 className={cn(
 "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-xl border border-border bg-background shadow-[0_8px_32px_rgba(0,0,0,0.12)]",
 "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
 "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
 "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
 position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1 w-[var(--radix-select-trigger-width)]",
 className
 )}
 position={position}
 {...props}
 >
 <SelectPrimitive.Viewport className={cn("p-1", position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]")}>
 {children}
 </SelectPrimitive.Viewport>
 </SelectPrimitive.Content>
 </SelectPrimitive.Portal>
 );
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
 return <SelectPrimitive.Label className={cn("px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider", className)} {...props} />;
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
 return (
 <SelectPrimitive.Item
 className={cn(
 "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2.5 pl-9 pr-3 text-sm font-medium outline-none",
 "transition-colors duration-100",
 "focus:bg-muted focus:text-foreground",
 "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
 className
 )}
 {...props}
 >
 <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
 <SelectPrimitive.ItemIndicator>
 <Check size={14} weight="bold" className="text-primary" />
 </SelectPrimitive.ItemIndicator>
 </span>
 <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
 </SelectPrimitive.Item>
 );
}

function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) {
 return <SelectPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator };
