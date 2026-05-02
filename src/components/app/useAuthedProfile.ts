import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export type AuthedProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  plan_tier: string;
  access_status: string;
  is_owner: boolean;
  is_unlimited: boolean;
  monthly_api_budget_eur: number;
  api_spend_this_cycle_eur: number;
};

/**
 * Guards any /dashboard/* route. Redirects:
 *  - no session → /auth/login
 *  - pending_approval → /auth/access-pending
 *  - suspended → /auth/suspended
 */
export function useAuthedProfile(opts?: { ownerOnly?: boolean }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AuthedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadProfile(userId: string) {
      const { data: prof } = await supabase
        .from("profiles")
        .select(
          "id, email, display_name, avatar_url, plan_tier, access_status, is_owner, is_unlimited, monthly_api_budget_eur, api_spend_this_cycle_eur"
        )
        .eq("id", userId)
        .maybeSingle();
      if (!active) return;
      if (!prof) {
        navigate("/auth/login");
        return;
      }
      if (prof.access_status === "pending_approval") {
        navigate("/auth/access-pending");
        return;
      }
      if (prof.access_status === "suspended") {
        navigate("/auth/suspended");
        return;
      }
      if (opts?.ownerOnly && !prof.is_owner) {
        navigate("/dashboard");
        return;
      }
      setProfile(prof as AuthedProfile);
      setLoading(false);
    }

    // Set up listener FIRST (no await inside)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session?.user) {
        setProfile(null);
        setLoading(false);
        navigate("/auth/login");
        return;
      }
      // defer profile fetch to avoid deadlock
      setTimeout(() => {
        if (active) loadProfile(session.user.id);
      }, 0);
    });

    // Then check existing session (restores from storage)
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session?.user) {
        setLoading(false);
        navigate("/auth/login");
        return;
      }
      loadProfile(data.session.user.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate, opts?.ownerOnly]);

  return { profile, loading };
}
