import { Link } from "react-router-dom";
import { KeyRound, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function ForgotPassword() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <section className="w-full max-w-md text-center">
        <Logo size="md" />
        <div className="h-12 w-12 rounded-full bg-primary-wash text-primary flex items-center justify-center mx-auto mt-8">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold mt-5">
          No REELassati password to reset
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mt-3">
          This private checkpoint uses your authenticated ChatGPT workspace
          session, so no password is stored by the app.
        </p>
        <Link
          to="/auth/login"
          className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover mt-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to studio access
        </Link>
      </section>
    </div>
  );
}
