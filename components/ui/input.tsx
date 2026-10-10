import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, id, className, ...props }: InputProps) {
  const inputId = React.useId();
  const resolvedId = id ?? inputId;
  const hintId = hint ? `${resolvedId}-hint` : undefined;
  const errorId = error ? `${resolvedId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5" data-invalid={error ? true : undefined}>
      <label htmlFor={resolvedId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={resolvedId}
        aria-describedby={describedBy}
        aria-errormessage={errorId}
        aria-invalid={error ? true : undefined}
        disabled={props.disabled}
        className={cn(
          "min-h-11 rounded-md border border-input bg-background px-3 text-base text-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          error && "border-destructive",
          className,
        )}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-brand-ink">
          {error}
        </p>
      )}
    </div>
  );
}
