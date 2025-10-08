import { cn } from '@/lib/utils'
import React from 'react'

interface MobileFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode
  className?: string
}

export function MobileForm({ children, className, ...props }: MobileFormProps) {
  return (
    <form
      className={cn(
        "space-y-6 md:space-y-4", // More spacing on mobile
        className
      )}
      {...props}
    >
      {children}
    </form>
  )
}

interface MobileFormFieldProps {
  children: React.ReactNode
  error?: string
  className?: string
}

export function MobileFormField({ children, error, className }: MobileFormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {children}
      {error && (
        <p className="text-sm text-destructive font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

interface MobileFormSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function MobileFormSection({
  title,
  description,
  children,
  className
}: MobileFormSectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <h2 className="text-xl md:text-2xl font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
