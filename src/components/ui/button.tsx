import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] border",
  {
    variants: {
      variant: {
        default: "bg-[#6366F1] text-white border-indigo-400/30 shadow-sm shadow-indigo-500/25 hover:bg-[#4F46E5]",
        primary: "bg-[#6366F1] text-white border-indigo-400/30 shadow-sm shadow-indigo-500/25 hover:bg-[#4F46E5]",
        secondary: "bg-purple-500/15 text-purple-200 border-purple-500/30 hover:bg-purple-500/25 hover:text-white",
        outline: "border-white/[0.08] bg-transparent text-slate-200 hover:bg-white/[0.05] hover:text-white",
        ghost: "border-white/[0.05] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white",
        danger: "border-rose-500/25 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 hover:text-white",
        destructive: "border-rose-500/30 bg-rose-600 text-white hover:bg-rose-700",
        success: "border-emerald-500/25 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 hover:text-white",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 text-xs",
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-xs",
        lg: "h-11 px-6 text-sm",
        icon: "size-9",
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