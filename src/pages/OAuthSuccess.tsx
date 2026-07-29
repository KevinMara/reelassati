import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";

export default function OAuthSuccess() {
  const navigate = useNavigate();
  const { enterStudio, error } = useAuth();

  useEffect(() => {
    void enterStudio().then(ok => {
      navigate(ok ? "/dashboard" : "/auth/login", { replace: true });
    });
  }, [enterStudio, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center">
      <Logo size="md" />
      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">
          {error || "Verifying your studio session…"}
        </p>
      </div>
    </div>
  );
}
