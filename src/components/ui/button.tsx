import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium ring-offset-background transition-all duration-200 ease-out-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background hover:bg-foreground/90 rounded-md",
        // Reelassati signature: pill-shaped amethyst CTA
        primary:
          "bg-primary text-primary-foreground rounded-pill shadow-card hover:shadow-card-hover hover:bg-primary-hover",
        ghost:
          "rounded-pill text-foreground hover:bg-foreground/[0.04]",
        outline:
          "border border-strong text-foreground rounded-pill hover:bg-foreground/[0.03]",
        link: "text-primary underline-offset-4 hover:underline rounded-md",
        destructive:
          "bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90",
        secondary:
          "bg-secondary text-secondary-foreground rounded-pill hover:bg-secondary/80",
        // Quiet text-only nav
        nav: "rounded-pill text-foreground/70 hover:text-foreground hover:bg-foreground/[0.04] text-sm",
      },
      size: {
        default: "h-10 px-5 text-sm",
        sm: "h-9 px-4 text-sm",
        lg: "h-12 px-7 text-base",
        xl: "h-14 px-8 text-base",
        icon: "h-10 w-10",
        "icon-sm": "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
