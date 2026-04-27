import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import LandingPage from "@/components/landing-page"

export const dynamic = "force-dynamic"

/**
 * Public root route. Authenticated users are sent straight to the unified
 * dashboard; everyone else sees the marketing landing page.
 */
export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  return <LandingPage />
}
