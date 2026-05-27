import { useEffect, useState } from "react";


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

export function useAuthedProfile(opts?: { ownerOnly?: boolean }) {

  const [profile, setProfile] = useState<AuthedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();

        if (!active) return;

        if (!data.ok || !data.user) {
          window.location.href = "/auth/login";
          return;
        }


        // Map backend user to AuthedProfile format
        // Defaulting plan fields as they might be handled differently now
        const prof: AuthedProfile = {
          id: data.user.id,
          email: data.user.email,
          display_name: data.user.display_name,
          avatar_url: data.user.avatar_url,
          plan_tier: "free",
          access_status: "approved",
          is_owner: true,
          is_unlimited: false,
          monthly_api_budget_eur: 0,
          api_spend_this_cycle_eur: 0,
        };

        if (opts?.ownerOnly && !prof.is_owner) {
          window.location.href = "/dashboard";
          return;
        }


        setProfile(prof);
        setLoading(false);
      } catch (err) {
        console.error("Auth check failed:", err);
        if (active) {
          window.location.href = "/auth/login";
        }
      }
    }

    checkAuth();

    return () => {
      active = false;
    };
  }, [opts?.ownerOnly]);


  return { profile, loading };
}
