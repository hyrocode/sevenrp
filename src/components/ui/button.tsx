import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 active:scale-[0.99] border select-none",
  {
    variants: {
      variant: {
        default: "bg-[#7C3AED] text-white border-purple-500/40 shadow-sm hover:bg-[#6D28D9]",
        primary: "bg-[#7C3AED] text-white border-purple-500/40 shadow-sm hover:bg-[#6D28D9]",
        secondary: "bg-white/[0.05] text-slate-200 border-white/[0.09] hover:bg-white/[0.08] hover:text-white",
        outline: "border-white/[0.10] bg-transparent text-slate-300 hover:bg-white/[0.05] hover:text-white",
        ghost: "border-transparent bg-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-200",
        danger: "border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-white",
        destructive: "border-rose-600/40 bg-rose-600 text-white hover:bg-rose-700",
        success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-white",
        link: "border-transparent text-purple-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3.5 text-xs",
        sm: "h-7 px-2.5 text-[11px]",
        md: "h-8.5 px-3.5 text-xs",
        lg: "h-9.5 px-4 text-xs",
        icon: "size-8",
      },
    },
    defaultVariants: { variant: "secondary", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ asChild, className, variant, size, ...props }, ref) => {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});
Button.displayName = "Button";