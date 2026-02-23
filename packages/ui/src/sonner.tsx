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
 actionButton: "btn-primary text-xs px-3 py-1.5 h-auto",
 cancelButton: "btn-secondary text-xs px-3 py-1.5 h-auto",
 closeButton: "text-muted-foreground hover:text-foreground",
 },
 }}
 {...props}
 />
 );
}
