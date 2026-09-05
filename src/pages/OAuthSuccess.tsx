import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { consumeAuthNext } from "@/lib/auth-next";

export default function OAuthSuccess() {
  const navigate = useNavigate();
  const { user, loading, error } = useAuth();

  useEffect(() => {
    if (loading) return;
    navigate(user ? consumeAuthNext() : "/auth/login", { replace: true });
  }, [loading, navigate, user]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <Logo size="md" />
      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">
          {error || "Securing your session…"}
        </p>
      </div>
    </div>
  );
}
