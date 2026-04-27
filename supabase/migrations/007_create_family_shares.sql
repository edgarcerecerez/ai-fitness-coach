-- Family sharing: lets a user invite family members to view their health data
-- Phase 5 ships only the data model + management UI. The invitee acceptance
-- flow (linking shared_with_email -> shared_with_user_id) is intentionally
-- left for a future phase.

CREATE TABLE IF NOT EXISTS public.family_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_with_email TEXT NOT NULL,
    shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    permissions TEXT[] NOT NULL DEFAULT ARRAY['view_weight', 'view_nutrition', 'view_mood']::TEXT[],
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    -- Prevent duplicate pending/accepted invites for the same recipient
    CONSTRAINT family_shares_owner_email_unique UNIQUE (owner_id, shared_with_email)
);

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_family_shares_owner_id ON public.family_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_family_shares_shared_with_user_id ON public.family_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_family_shares_shared_with_email ON public.family_shares(LOWER(shared_with_email));

-- RLS: owner CRUD their own rows; invitee can SELECT only accepted shares
ALTER TABLE public.family_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their own family shares"
    ON public.family_shares
    FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Owners can create family shares"
    ON public.family_shares
    FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their own family shares"
    ON public.family_shares
    FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their own family shares"
    ON public.family_shares
    FOR DELETE
    USING (auth.uid() = owner_id);

CREATE POLICY "Invitees can view accepted shares targeted at them"
    ON public.family_shares
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL
        AND auth.uid() = shared_with_user_id
        AND status = 'accepted'
    );

COMMENT ON TABLE public.family_shares IS 'Phase 5: family sharing invitations. Owner creates; invitee accepts in a future phase by populating shared_with_user_id and setting status=accepted.';
COMMENT ON COLUMN public.family_shares.permissions IS 'Subset of {view_weight, view_nutrition, view_mood}. Extend as new data types are added.';
