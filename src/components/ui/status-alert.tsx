import { AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatusAlertProps {
  readonly variant: "error" | "success" | "info" | "warning"
  readonly message: string
  readonly className?: string
}

const variants = {
  error: {
    container: "bg-destructive/10 border-destructive/20 text-destructive",
    icon: XCircle,
  },
  success: {
    container: "bg-chart-1/10 border-chart-1/20 text-chart-1",
    icon: CheckCircle2,
  },
  info: {
    container: "bg-chart-2/10 border-chart-2/20 text-chart-2",
    icon: Info,
  },
  warning: {
    container: "bg-chart-4/10 border-chart-4/20 text-chart-4",
    icon: AlertCircle,
  },
} as const

export function StatusAlert({ variant, message, className }: StatusAlertProps) {

  const config = variants[variant]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        config.container,
        className
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <p className="text-sm leading-relaxed">{message}</p>
    </div>
  )
}