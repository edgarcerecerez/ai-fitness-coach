import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import AppNav from "@/components/shared/AppNav"

/**
 * Layout for the `(protected)` route group. Performs the auth check on the
 * server, redirecting unauthenticated visitors to `/login`, and mounts the
 * shared top app bar so every protected page renders with consistent navigation.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav email={user.email ?? null} />
      <main>{children}</main>
    </div>
  )
}
