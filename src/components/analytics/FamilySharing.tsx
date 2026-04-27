"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, Mail, Trash2 } from "lucide-react"

type SharePermission = "view_weight" | "view_nutrition" | "view_mood"

interface FamilyShare {
  id: string
  shared_with_email: string
  shared_with_user_id: string | null
  permissions: SharePermission[]
  status: "pending" | "accepted" | "revoked"
  created_at: string
  accepted_at: string | null
}

const ALL_PERMISSIONS: { value: SharePermission; label: string }[] = [
  { value: "view_weight", label: "Weight" },
  { value: "view_nutrition", label: "Nutrition" },
  { value: "view_mood", label: "Mood" },
]

const DEFAULT_PERMISSIONS: SharePermission[] = ALL_PERMISSIONS.map((p) => p.value)

const STATUS_VARIANT: Record<
  FamilyShare["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  accepted: "default",
  revoked: "secondary",
}

const SHARE_COLUMNS =
  "id, shared_with_email, shared_with_user_id, permissions, status, created_at, accepted_at"

// Standard "no spaces, an @, and a dot in the domain" check. Good enough for
// the invite UI; the backend / Supabase auth still owns the canonical check.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Postgres unique_violation: duplicate row for (owner_id, shared_with_email).
const PG_UNIQUE_VIOLATION = "23505"

export function FamilySharing() {
  const supabase = useMemo(() => createClient(), [])
  const [shares, setShares] = useState<FamilyShare[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [permissions, setPermissions] = useState<SharePermission[]>(DEFAULT_PERMISSIONS)

  const fetchShares = useCallback(async () => {
    setError(null)
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      setError("You must be signed in to manage family sharing.")
      setLoading(false)
      return
    }
    const { data, error: queryError } = await supabase
      .from("family_shares")
      .select(SHARE_COLUMNS)
      .eq("owner_id", userData.user.id)
      .order("created_at", { ascending: false })

    if (queryError) {
      setError(queryError.message)
    } else {
      setShares((data ?? []) as FamilyShare[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void fetchShares()
  }, [fetchShares])

  const togglePermission = (p: SharePermission) => {
    setPermissions((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      setError("Please enter a valid email address.")
      return
    }
    if (permissions.length === 0) {
      setError("Select at least one permission to share.")
      return
    }

    setSubmitting(true)
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      setError("You must be signed in to invite family members.")
      setSubmitting(false)
      return
    }

    // TODO(phase-future): trigger an email to `trimmed` with an acceptance link
    // that, on click, populates shared_with_user_id and sets status='accepted'.
    const { error: insertError } = await supabase.from("family_shares").insert({
      owner_id: userData.user.id,
      shared_with_email: trimmed,
      permissions,
      status: "pending",
    })

    if (insertError) {
      if (insertError.code === PG_UNIQUE_VIOLATION) {
        // Keep the email/permissions populated so the user can adjust and retry.
        setError("An invite for this email already exists.")
      } else {
        setError(insertError.message)
      }
    } else {
      setEmail("")
      setPermissions(DEFAULT_PERMISSIONS)
      await fetchShares()
    }
    setSubmitting(false)
  }

  const mutateShare = async (
    id: string,
    op: (id: string) => PromiseLike<{ error: { message: string } | null }>
  ) => {
    setError(null)
    const { error: opError } = await op(id)
    if (opError) {
      setError(opError.message)
    } else {
      await fetchShares()
    }
  }

  const handleRevoke = (id: string) =>
    mutateShare(id, (shareId) =>
      supabase.from("family_shares").update({ status: "revoked" }).eq("id", shareId)
    )

  const handleDelete = (share: FamilyShare) => {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(
        `Delete the invite for ${share.shared_with_email}? This cannot be undone.`
      )
    if (!confirmed) return
    void mutateShare(share.id, (shareId) =>
      supabase.from("family_shares").delete().eq("id", shareId)
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Family sharing</CardTitle>
        <CardDescription>
          Invite a family member by email and choose which categories of your data they can see.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="family.member@example.com"
                autoComplete="off"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Inviting…
                  </>
                ) : (
                  <>
                    <Mail className="size-4" /> Invite
                  </>
                )}
              </Button>
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Permissions</legend>
            <div className="flex flex-wrap gap-3">
              {ALL_PERMISSIONS.map((p) => (
                <label key={p.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={permissions.includes(p.value)}
                    onChange={() => togglePermission(p.value)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>
        </form>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Existing shares</h3>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : shares.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              You haven&apos;t invited anyone yet.
            </p>
          ) : (
            <ul className="divide-border divide-y rounded-md border">
              {shares.map((share) => (
                <li
                  key={share.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{share.shared_with_email}</div>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant={STATUS_VARIANT[share.status]}>{share.status}</Badge>
                      <span>{share.permissions.join(", ") || "no permissions"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {share.status !== "revoked" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevoke(share.id)}
                      >
                        Revoke
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete invite for ${share.shared_with_email}`}
                      onClick={() => handleDelete(share)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
