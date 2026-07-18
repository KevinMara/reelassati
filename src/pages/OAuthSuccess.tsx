import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Logo } from "@/components/Logo";

export default function OAuthSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setError("Missing authentication token");
      setTimeout(() => navigate("/auth/login"), 2000);
      return;
    }

    // Store token in localStorage for SPA auth
    localStorage.setItem("reelassati_token", token);

    // Redirect to dashboard after a brief moment
    const timer = setTimeout(() => {
      navigate("/dashboard");
    }, 500);

    return () => clearTimeout(timer);
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center">
        <Logo size="md" />
        <p className="mt-4 text-sm text-destructive">{error}</p>
        <p className="mt-2 text-xs text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center">
      <Logo size="md" />
      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
}
