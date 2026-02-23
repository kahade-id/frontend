import { cn } from "@kahade/utils";

interface EmptyStateProps {
 icon?: React.ElementType;
 title: string;
 description?: string;
 action?: { label: string; onClick: () => void; variant?: "primary" | "secondary" };
 className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
 return (
 <div className={cn("flex flex-col items-center justify-center py-16 px-8 text-center", className)}>
 {Icon && (
 <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
 <Icon size={40} className="text-muted-foreground" weight="thin" />
 </div>
 )}
 <h3 className="text-lg font-bold mb-2">{title}</h3>
 {description && <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">{description}</p>}
 {action && (
 <button
 onClick={action.onClick}
 className={action.variant === "secondary" ? "btn-secondary" : "btn-primary"}
 >
 {action.label}
 </button>
 )}
 </div>
 );
}
