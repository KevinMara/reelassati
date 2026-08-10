import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/providers/workspace";
import { ReferralCapture } from "@/components/ReferralCapture";
import EntryAnimation from "@/components/entry/EntryAnimation";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const OAuthSuccess = lazy(() => import("./pages/OAuthSuccess"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Support = lazy(() => import("./pages/Support"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const EntryDemo = lazy(() => import("./pages/EntryDemo"));
const Showcase = lazy(() => import("./pages/Showcase"));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage"));
const AITransparency = lazy(() => import("./pages/AITransparency"));
const ResponsibleUse = lazy(() => import("./pages/ResponsibleUse"));
const ProvenanceDetector = lazy(() => import("./pages/ProvenanceDetector"));

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
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (!user) return <Navigate to="/auth/login" replace />;

  return (
    <>
      <EntryAnimation />
      <Suspense
        fallback={
          <div className="min-h-screen bg-background" aria-hidden="true" />
        }
      >
        <WorkspaceProvider>
          <Dashboard />
        </WorkspaceProvider>
      </Suspense>
    </>
  );
}

function ScrollManager() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    let retryTimer = 0;
    let retry = 0;
    const scroll = () => {
      if (!hash) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        return;
      }
      const id = decodeURIComponent(hash.slice(1));
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({
          block: "start",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        });
        return;
      }
      // Lazy routes may still be resolving after code and workspace data load.
      if (retry < 40) {
        retry += 1;
        retryTimer = window.setTimeout(scroll, 50);
      }
    };
    retryTimer = window.setTimeout(scroll, 0);
    return () => window.clearTimeout(retryTimer);
  }, [hash, pathname]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ReferralCapture />
      <ScrollManager />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/contact" element={<Support />} />
          <Route path="/support" element={<Navigate to="/contact" replace />} />
          <Route path="/showcase" element={<Showcase />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/ai-transparency" element={<AITransparency />} />
          <Route path="/responsible-use" element={<ResponsibleUse />} />
          <Route path="/provenance" element={<ProvenanceDetector />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Signup />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/update-password" element={<UpdatePassword />} />
          <Route path="/auth/oauth-success" element={<OAuthSuccess />} />
          <Route path="/dashboard" element={<StudioRoute />} />
          <Route path="/dashboard/*" element={<StudioRoute />} />
          <Route path="/entry" element={<EntryDemo />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
