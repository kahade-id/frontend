import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@kahade/utils";

const buttonVariants = cva(
 [
 "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold",
 "transition-all duration-200 select-none cursor-pointer",
 "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
 "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
 "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[1.125rem] [&_svg]:shrink-0",
 "active:scale-[0.98]",
 ].join(" "),
 {
 variants: {
 variant: {
 default: "bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus-visible:ring-primary",
 destructive: "bg-destructive text-white rounded-md hover:bg-destructive/90 focus-visible:ring-destructive",
 outline: "border-2 border-border bg-transparent text-foreground rounded-md hover:border-foreground hover:bg-foreground hover:text-background focus-visible:ring-foreground",
 secondary: "border border-border bg-background text-foreground rounded-md hover:border-foreground/50 hover:bg-muted focus-visible:ring-foreground",
 ghost: "bg-transparent text-muted-foreground rounded-md hover:text-foreground hover:bg-muted focus-visible:ring-foreground",
 link: "text-primary underline-offset-4 hover:underline focus-visible:ring-primary",
 },
 size: {
 xs: "h-6 px-2.5 py-0.5 text-xs rounded-md gap-1",
 sm: "h-8 px-3 py-1.5 text-sm rounded-md",
 default: "h-10 px-5 py-2.5 text-[0.9375rem]",
 lg: "h-11 px-6 py-2.5 text-base rounded-md",
 xl: "h-12 px-8 py-3 text-lg rounded-lg",
 icon: "size-9 rounded-md p-0",
 "icon-sm": "size-7 rounded-md p-0",
 "icon-lg": "size-10 rounded-md p-0",
 },
 },
 defaultVariants: { variant: "default", size: "default" },
 }
);

function Button({
 className, variant, size, asChild = false, ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
 const Comp = asChild ? Slot : "button";
 return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
