import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@kahade/utils";
import { Info, CheckCircle, Warning, XCircle, X } from "@phosphor-icons/react";

const alertVariants = cva("flex gap-3 p-4 rounded-xl border", {
 variants: {
 variant: {
 info: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
 success: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
 warning: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800",
 error: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
 },
 },
 defaultVariants: { variant: "info" },
});

const textCls: Record<string,string> = {
 info: "text-blue-800 dark:text-blue-300",
 success: "text-green-800 dark:text-green-300",
 warning: "text-yellow-800 dark:text-yellow-300",
 error: "text-red-800 dark:text-red-300",
};
const iconMap = { info: Info, success: CheckCircle, warning: Warning, error: XCircle };

interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
 title?: string;
 description?: string;
 dismissible?: boolean;
 onDismiss?: () => void;
 icon?: React.ElementType;
}

function Alert({ className, variant = "info", title, description, dismissible, onDismiss, icon, children, ...props }: AlertProps) {
 const AlertIcon = icon ?? iconMap[variant ?? "info"];
 const text = textCls[variant ?? "info"];
 return (
 <div className={cn(alertVariants({ variant }), className)} {...props}>
 <AlertIcon weight="fill" size={18} className={cn("shrink-0 mt-0.5", text)} />
 <div className="flex-1">
 {title && <p className={cn("font-semibold text-sm mb-1", text)}>{title}</p>}
 {description && <p className={cn("text-sm", text)}>{description}</p>}
 {children && <div className={cn("text-sm", text)}>{children}</div>}
 </div>
 {dismissible && (
 <button onClick={onDismiss} className={cn("w-5 h-5 shrink-0 hover:opacity-80 transition-opacity", text)}>
 <X size={16} weight="bold" />
 </button>
 )}
 </div>
 );
}

function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
 return <p className={cn("font-semibold text-sm mb-1", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
 return <p className={cn("text-sm", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
