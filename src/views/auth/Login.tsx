import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import AuthShell from "./AuthShell";
import Field from "./Field";
import LoaderDots from "@/components/brand/LoaderDots";

export default function Login() {
    const { toast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorText("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        const msg =
          data?.error === "invalid_credentials"
            ? "Email or password is incorrect."
            : data?.message || data?.error || "Authentication is temporarily unavailable.";

        setErrorText(msg);
        toast({ title: msg, variant: "destructive" });
        return;
      }

      toast({ title: "Logged in." });
      navigate("/dashboard");
    } catch {
      const msg = "Network error. Preview protection may still be blocking the API.";
      setErrorText(msg);
      toast({ title: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={"Accedi al tuo account."}
      sub={"Bentornato su Reelassati."}
      footer={
        <>
          {"Non hai un account?"}{" "}
          <Link to="/auth/signup" className="text-primary">
            {"Crea account"}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" data-auth-version="email-api-v3">
        <Field name="email" label={"Email"} type="email" autoComplete="email" value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, email: e.target.value }))} required />
        <Field name="password" label={"Password"} type="password" autoComplete="current-password" value={form.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, password: e.target.value }))} required />

        {errorText ? <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">{errorText}</div> : null}

        <button type="submit" className="btn-hero w-full" disabled={loading}>
          {loading ? <LoaderDots /> : "Accedi"}
        </button>

        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground/60">
          <span className="h-px flex-1 bg-border" />
          {"OPPURE"}
          <span className="h-px flex-1 bg-border" />
        </div>

        <button type="button" disabled className="w-full rounded-full border border-border px-4 py-3 text-sm text-muted-foreground opacity-60">
          Google login non configurato
        </button>
      </form>
    </AuthShell>
  );
}

