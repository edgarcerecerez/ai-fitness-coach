import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { AppNavigation } from '@/components/app/navigation'
import { MobileNavigation } from '@/components/app/mobile-navigation'
import { Toaster } from '@/components/ui/toaster'
import { apiLogger } from '@/lib/logger'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError) {
      apiLogger.error('Supabase auth error during app layout render', {
        error: authError.message
      })
      redirect('/login')
    }

    if (!user) {
      redirect('/login')
    }

    return (
      <div className="min-h-screen app-gradient-bg">
        <AppNavigation user={user} />
        <main className="container mx-auto px-4 py-8 pb-20 md:pb-8">
          {children}
        </main>
        <MobileNavigation />
        <Toaster />
      </div>
    )
  } catch (error) {
    apiLogger.error('Failed to render app layout', {
      error: error instanceof Error ? error.message : String(error)
    })
    redirect('/login')
  }
}
