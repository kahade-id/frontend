import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@kahade/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold",
    "text-[var(--button-font-size,0.875rem)] leading-none",
    "rounded-[var(--button-radius,var(--radius,0.625rem))]",
    "h-[var(--button-height-md,2.75rem)] px-[var(--button-padding-x-md,1.125rem)]",
    "transition-colors duration-200 select-none cursor-pointer",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary",
        secondary: "border border-border bg-background text-foreground hover:bg-muted focus-visible:ring-foreground",
        outline: "border border-border bg-transparent text-foreground hover:bg-muted focus-visible:ring-foreground",
        ghost: "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive",
        link: "h-auto px-0 py-0 rounded-none text-primary underline-offset-4 hover:underline focus-visible:ring-primary",
      },
      size: {
        sm: "h-[var(--button-height-sm,2.5rem)] px-[var(--button-padding-x-sm,0.875rem)] text-[0.8125rem]",
        md: "h-[var(--button-height-md,2.75rem)] px-[var(--button-padding-x-md,1.125rem)]",
        lg: "h-[var(--button-height-lg,3rem)] px-[var(--button-padding-x-lg,1.5rem)] text-[0.9375rem]",
        icon: "size-[var(--button-height-md,2.75rem)] p-0",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  leftIcon,
  rightIcon,
  children,
  fullWidth,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  const adornment = loading ? (
    <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden="true" />
  ) : (
    leftIcon
  );

  if (asChild) {
    const childElement = React.Children.only(children);

    if (!React.isValidElement(childElement)) {
      throw new Error("Button with asChild expects a single valid React element child.");
    }

    const mergedChild = React.cloneElement(
      childElement,
      undefined,
      <>
        {adornment}
        {(childElement.props as { children?: React.ReactNode }).children}
        {rightIcon}
      </>
    );

    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        {...props}
      >
        {mergedChild}
      </Comp>
    );
  }

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, fullWidth, className }))}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...props}
    >
      {adornment}
      {children}
      {rightIcon}
    </Comp>
  );
}

export { Button, buttonVariants };
