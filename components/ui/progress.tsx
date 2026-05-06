"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type Props = React.ComponentProps<"div"> & {
  /** 0..100 */
  value?: number | null;
};

export function Progress({ value, className, ...props }: Props) {
  const v = typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div
      data-slot="progress"
      className={cn(
        "relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200",
        "dark:bg-slate-800",
        className,
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className="h-full rounded-full bg-[#1E3A8A] transition-[width] duration-500 ease-out"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

