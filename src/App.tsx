import { lazy, Suspense, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/providers/workspace";
import { ReferralCapture } from "@/components/ReferralCapture";
import { ENTRY_ORIGIN_SCROLL_KEY, SESSION_KEY } from "@/components/entry/entry-constants";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const OAuthSuccess = lazy(() => import("./pages/OAuthSuccess"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Support = lazy(() => import("./pages/Support"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const EntryDemo = lazy(() => import("./pages/EntryDemo"));
const Showcase = lazy(() => import("./pages/Showcase"));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
        role="status"
        aria-label="Loading REELassati"
      />
    </div>
  );
}

function StudioRoute() {
  return (
    <WorkspaceProvider>
      <Dashboard />
    </WorkspaceProvider>
  );
}

function StudioEntryCapture() {
  useEffect(() => {
    const rememberOrigin = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;

      const destination = new URL(link.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        !destination.pathname.startsWith("/dashboard") ||
        window.location.pathname.startsWith("/dashboard")
      ) {
        return;
      }

      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.setItem(ENTRY_ORIGIN_SCROLL_KEY, String(window.scrollY));
    };

    document.addEventListener("click", rememberOrigin, true);
    return () => document.removeEventListener("click", rememberOrigin, true);
  }, []);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ReferralCapture />
      <StudioEntryCapture />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/support" element={<Support />} />
          <Route path="/showcase" element={<Showcase />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Signup />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/oauth-success" element={<OAuthSuccess />} />
          <Route path="/dashboard" element={<StudioRoute />} />
          <Route path="/dashboard/*" element={<StudioRoute />} />
          <Route path="/entry" element={<EntryDemo />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
