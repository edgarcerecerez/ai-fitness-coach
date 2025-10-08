"use client"

import { useState } from 'react'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { 
  Activity, 
  Camera, 
  User as UserIcon, 
  Settings, 
  LogOut 
} from 'lucide-react'
import Link from 'next/link'
import { logAuthEvent } from '@/lib/logger'

interface AppNavigationProps {
  readonly user: User
}

export function AppNavigation({ user }: AppNavigationProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignOut = async () => {
    setIsLoading(true)
    const supabase = createClient()
    
    logAuthEvent('logout_attempt', user.id)
    
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out error:', error)
    } else {
      logAuthEvent('logout_success', user.id)
      router.push('/')
    }
    setIsLoading(false)
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/app" className="text-xl font-bold text-foreground">
              AI Fitness Coach
            </Link>
            
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/app" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
                <Activity className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <Link href="/app/calorie-tracker" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
                <Camera className="w-4 h-4" />
                <span>Calorie Tracker</span>
              </Link>
              <Link href="/app/profile" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
                <UserIcon className="w-4 h-4" />
                <span>Profile</span>
              </Link>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="touch" className="relative rounded-full">
                <UserIcon className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <span className="font-medium">{user.email}</span>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/app/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleSignOut} 
                disabled={isLoading}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {isLoading ? 'Signing out...' : 'Sign out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  )
}
