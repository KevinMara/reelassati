import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "@/lib/i18n";
import Home from "./views/Home";

import Pricing from "./views/Pricing";
import Support from "./views/Support";
import Login from "./views/auth/Login";
import Signup from "./views/auth/Signup";
import ForgotPassword from "./views/auth/ForgotPassword";
import ResetPassword from "./views/auth/ResetPassword";
import AccessPending from "./views/auth/AccessPending";
import Suspended from "./views/auth/Suspended";
import DashboardHome from "./views/dashboard/DashboardHome";
import AdminPanel from "./views/dashboard/AdminPanel";
import Clients from "./views/dashboard/Clients";
import ClientDetail from "./views/dashboard/ClientDetail";
import LibraryPage from "./views/dashboard/Library";
import CalendarPage from "./views/dashboard/CalendarPage";
import SocialAccounts from "./views/dashboard/SocialAccounts";
import SettingsPage from "./views/dashboard/Settings";
import Analyze from "./views/dashboard/Analyze";
import Script from "./views/dashboard/Script";
import Edit from "./views/dashboard/Edit";
import Publish from "./views/dashboard/Publish";
import Analytics from "./views/dashboard/Analytics";
import Orchestrator from "./views/dashboard/Orchestrator";
import NotFound from "./views/NotFound";
import VideoUploadFlow from "./components/VideoUploadFlow";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
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
        <Route path="/admin/settings" element={<SettingsPage />} />

        <Route path="/upload" element={<VideoUploadFlow />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
