import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 rounded-xl border border-dashed p-8">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-primary">
        <Icon className="h-6 w-6" />
      </span>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
      </div>
      {action}
    </div>
  )
}
