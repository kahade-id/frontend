import { Toaster as Sonner, ToasterProps } from "sonner";

export function Toaster({ ...props }: ToasterProps) {
 return (
 <Sonner
 theme="system"
 className="toaster group"
 toastOptions={{
 classNames: {
 toast: [
 "group toast flex items-center gap-3",
 "bg-background border border-border rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)]",
 "px-4 py-3 w-80",
 "data-[type=success]:border-green-200 dark:data-[type=success]:border-green-800",
 "data-[type=error]:border-red-200 dark:data-[type=error]:border-red-800",
 "data-[type=warning]:border-yellow-200 dark:data-[type=warning]:border-yellow-800",
 ].join(" "),
 title: "font-semibold text-sm text-foreground",
 description: "text-xs text-muted-foreground mt-0.5",
 actionButton: "inline-flex items-center justify-center h-8 px-3 rounded-[var(--button-radius,var(--radius,0.625rem))] bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90",
 cancelButton: "inline-flex items-center justify-center h-8 px-3 rounded-[var(--button-radius,var(--radius,0.625rem))] border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted",
 closeButton: "text-muted-foreground hover:text-foreground",
 },
 }}
 {...props}
 />
 );
}
