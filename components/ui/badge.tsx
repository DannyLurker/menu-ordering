import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-md px-2.5 py-0.5 text-sm font-medium", {
  variants: {
    tone: {
      neutral: "bg-muted text-muted-foreground",
      brand: "bg-primary text-primary-foreground",
      danger: "bg-destructive text-destructive-foreground",
      ok: "bg-muted text-foreground",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
