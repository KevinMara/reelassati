import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import "@/lib/i18n";

// Removed imports



import Pricing from "./pages/Pricing";
import Support from "./pages/Support";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import AccessPending from "./pages/auth/AccessPending";
import Suspended from "./pages/auth/Suspended";
import DashboardHome from "./pages/dashboard/DashboardHome";
import AdminPanel from "./pages/dashboard/AdminPanel";
import Clients from "./pages/dashboard/Clients";
import ClientDetail from "./pages/dashboard/ClientDetail";
import LibraryPage from "./pages/dashboard/Library";
import CalendarPage from "./pages/dashboard/CalendarPage";
import SocialAccounts from "./pages/dashboard/SocialAccounts";
import SettingsPage from "./pages/dashboard/Settings";
import Analyze from "./pages/dashboard/Analyze";
import Script from "./pages/dashboard/Script";
import Edit from "./pages/dashboard/Edit";
import Publish from "./pages/dashboard/Publish";
import Analytics from "./pages/dashboard/Analytics";
import Orchestrator from "./pages/dashboard/Orchestrator";
// import { SupportInApp } from "./pages/dashboard/Placeholders";
import NotFound from "./pages/NotFound";

// Reelassati Admin and Upload
// Removed import

import VideoUploadFlow from "./components/VideoUploadFlow";

const queryClient = new QueryClient();

const App = ({ children }: { children?: React.ReactNode }) => (

  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Pricing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/support" element={<Support />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/signup" element={<Signup />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/auth/access-pending" element={<AccessPending />} />
            <Route path="/auth/suspended" element={<Suspended />} />
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/dashboard/admin" element={<AdminPanel />} />
            <Route path="/dashboard/clients" element={<Clients />} />
            <Route path="/dashboard/clients/:id" element={<ClientDetail />} />
            <Route path="/dashboard/analyze" element={<Analyze />} />
            <Route path="/dashboard/script" element={<Script />} />
            <Route path="/dashboard/edit" element={<Edit />} />
            <Route path="/dashboard/publish" element={<Publish />} />
            <Route path="/dashboard/analytics" element={<Analytics />} />
            <Route path="/dashboard/orchestrator" element={<Orchestrator />} />
            <Route path="/dashboard/library" element={<LibraryPage />} />
            <Route path="/dashboard/calendar" element={<CalendarPage />} />
            <Route path="/dashboard/social-accounts" element={<SocialAccounts />} />
            <Route path="/dashboard/settings" element={<SettingsPage />} />
            <Route path="/dashboard/support" element={<div>Support</div>} />
            
            {/* Reelassati Platform Routes */}
            {/* <Route path="/admin/settings" element={<AdminSettings />} /> */}
            <Route path="/upload" element={<VideoUploadFlow />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
          {children}
        </BrowserRouter>

      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
