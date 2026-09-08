"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/** Native browser scroll container (no Radix scrollbar). */
function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="scroll-area"
      className={cn(
        "relative min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "vertical" | "horizontal"
}) {
  // Kept for API compatibility; native scrollbars are styled in globals.css.
  void orientation
  void className
  void props
  return null
}

export { ScrollArea, ScrollBar }
