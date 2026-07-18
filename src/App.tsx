import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import OAuthSuccess from "./pages/OAuthSuccess";
import ForgotPassword from "./pages/ForgotPassword";
import Pricing from "./pages/Pricing";
import Support from "./pages/Support";
import Dashboard from "./pages/Dashboard";
import EntryDemo from "./pages/EntryDemo";
import Showcase from "./pages/Showcase";
import TemplatesPage from "./pages/TemplatesPage";

export default function App() {
  return (
    <AuthProvider>
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
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/*" element={<Dashboard />} />
        <Route path="/entry" element={<EntryDemo />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </AuthProvider>
  );
}
