import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-3xl bg-muted", className)}
      {...props} />
  );
}

export { Skeleton }
