import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@kahade/utils";

const badgeVariants = cva(
 "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[0.6875rem] font-bold tracking-wide uppercase border",
 {
 variants: {
 variant: {
 primary: "bg-primary text-primary-foreground border-primary",
 secondary: "bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700",
 success: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
 warning: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
 error: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
 info: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
 outline: "border-2 border-foreground text-foreground bg-transparent",
 },
 },
 defaultVariants: { variant: "secondary" },
 }
);

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
 icon?: React.ElementType;
 label?: string;
}

function Badge({ className, variant, icon: Icon, label, children, ...props }: BadgeProps) {
 return (
 <span className={cn(badgeVariants({ variant }), className)} {...props}>
 {Icon && <Icon size={10} weight="fill" />}
 {label ?? children}
 </span>
 );
}

export { Badge, badgeVariants };
