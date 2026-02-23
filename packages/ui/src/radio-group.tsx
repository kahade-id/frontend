import * as React from "react";
import { cn } from "@kahade/utils";

// FIX (v3.3): Radio Button — peer-checked:scale-100 pada GRANDCHILD peer tidak bekerja.
// Sama dengan checkbox — inner dot di dalam outer ring div tidak terjangkau.
// Solusi: Gunakan absolute-positioned siblings dengan inset-[5px] untuk inner dot.

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
 label?: string;
}

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
 ({ className, label, id, ...props }, ref) => {
 const internalId = id || React.useId();

 return (
 <label
 htmlFor={internalId}
 className={cn(
 "flex items-center gap-3 cursor-pointer group select-none",
 props.disabled && "cursor-not-allowed opacity-60",
 className
 )}
 >
 <div className="relative flex items-center justify-center shrink-0 w-5 h-5">
 {/* Hidden input */}
 <input
 ref={ref}
 id={internalId}
 type="radio"
 className="peer sr-only"
 {...props}
 />
 {/* FIX: outer ring — sibling langsung dari <input peer> */}
 <div
 className={cn(
 "w-5 h-5 rounded-full border-2 border-border",
 "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2",
 "peer-checked:border-primary",
 "peer-disabled:opacity-50",
 "transition-all duration-150"
 )}
 />
 {/* FIX: inner dot — absolute sibling dengan inset-[5px] (tidak grandchild) */}
 <div
 className={cn(
 "absolute rounded-full bg-primary",
 "scale-0 peer-checked:scale-100",
 "transition-transform duration-150",
 "pointer-events-none"
 )}
 style={{ inset: '5px' }}
 />
 </div>
 {label && (
 <span className="text-sm font-medium leading-none">
 {label}
 </span>
 )}
 </label>
 );
 }
);

Radio.displayName = "Radio";

// RadioGroup container
export interface RadioGroupProps {
 children: React.ReactNode;
 className?: string;
 orientation?: 'vertical' | 'horizontal';
}

function RadioGroup({ children, className, orientation = 'vertical' }: RadioGroupProps) {
 return (
 <div
 role="radiogroup"
 className={cn(
 orientation === 'vertical' ? 'flex flex-col gap-3' : 'flex flex-row flex-wrap gap-4',
 className
 )}
 >
 {children}
 </div>
 );
}

export { Radio, RadioGroup };
