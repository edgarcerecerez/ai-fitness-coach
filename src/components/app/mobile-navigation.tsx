"use client"

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, Camera, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigationItems = [
  { name: 'Dashboard', href: '/app', icon: Home },
  { name: 'Tracker', href: '/app/calorie-tracker', icon: Camera },
  { name: 'Analytics', href: '/app/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/app/settings', icon: Settings },
] as const

export function MobileNavigation() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-white/20 md:hidden safe-area-bottom">
      <div className="grid grid-cols-4 h-16">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-xs transition-all duration-200 min-h-[44px] min-w-[44px]",
                isActive
                  ? "text-primary bg-primary/10 rounded-lg mx-1 my-1"
                  : "text-muted-foreground hover:text-foreground active:bg-primary/5"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "scale-110")} />
              <span className="text-[10px]">{item.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}