import * as React from "react";
import { cn } from "@kahade/utils";

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
 return (
 <div
 className={cn(
 "rounded-xl border border-border bg-card",
 "shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.04)]",
 "transition-all duration-200",
 className
 )}
 {...props}
 />
 );
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
 return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
 return <h3 className={cn("font-bold leading-none tracking-tight", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
 return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
 return <div className={cn("p-6 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
 return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
