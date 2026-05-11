import clsx from "clsx";
import React, { forwardRef } from "react";

export const Textarea = forwardRef(function Textarea(
  { className, ...props }: React.ComponentPropsWithoutRef<"textarea">,
  ref: React.ForwardedRef<HTMLTextAreaElement>
) {
  return (
    <span
      data-slot="control"
      className={clsx([
        className,
        "relative block w-full",
        "before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm",
        "dark:before:hidden",
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500",
        "has-data-disabled:opacity-50 has-data-disabled:before:bg-zinc-950/5 has-data-disabled:before:shadow-none",
      ])}
    >
      <textarea
        ref={ref}
        {...props}
        className={clsx([
          "relative block w-full appearance-none rounded-lg px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)]",
          "text-base/6 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/6 dark:text-white",
          "border border-zinc-950/10 data-hover:border-zinc-950/20 dark:border-white/10 dark:data-hover:border-white/20",
          "bg-transparent dark:bg-white/5",
          "focus:outline-hidden",
          "dark:scheme-dark",
          "resize-y",
        ])}
      />
    </span>
  );
});
