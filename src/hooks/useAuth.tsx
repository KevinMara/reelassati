import { createContext, useContext, useState, useCallback, useEffect } from "react";

interface AuthUser {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
  role?: string;
  subscription?: string;
  credits?: number;
  onboardingCompleted?: boolean;
  language?: string;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => boolean;
  signup: (name: string, email: string, password: string) => boolean;
  googleLogin: () => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Check JWT session on mount ─────────────────────────────────────────────
  const checkSession = useCallback(async () => {
    const token = localStorage.getItem("reelassati_token");

    if (token) {
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            setLoading(false);
            return;
          }
        }
        // Token invalid, clear it
        localStorage.removeItem("reelassati_token");
      } catch {
        localStorage.removeItem("reelassati_token");
      }
    }

    // Fallback: check local auth
    const saved = localStorage.getItem("reelassati_user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) setUser(parsed);
      } catch { /* ignore */ }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // ── Local Login ────────────────────────────────────────────────────────────
  const login = useCallback((email: string, password: string) => {
    const users = JSON.parse(localStorage.getItem("reelassati_users") || "[]");
    const found = users.find((u: any) => u.email === email && u.password === password);
    if (found) {
      const u = { id: found.id || Date.now(), name: found.name, email: found.email };
      setUser(u);
      localStorage.setItem("reelassati_user", JSON.stringify(u));
      return true;
    }
    return false;
  }, []);

  // ── Local Signup ───────────────────────────────────────────────────────────
  const signup = useCallback((name: string, email: string, password: string) => {
    const users = JSON.parse(localStorage.getItem("reelassati_users") || "[]");
    if (users.find((u: any) => u.email === email)) return false;
    const newUser = { id: Date.now(), name, email, password };
    users.push(newUser);
    localStorage.setItem("reelassati_users", JSON.stringify(users));
    const u = { id: newUser.id, name: newUser.name, email: newUser.email };
    setUser(u);
    localStorage.setItem("reelassati_user", JSON.stringify(u));
    return true;
  }, []);

  // ── Google OAuth Login ─────────────────────────────────────────────────────
  const googleLogin = useCallback(() => {
    // Fetch the Google auth URL from backend and redirect
    fetch("/api/auth/google")
      .then((res) => res.json())
      .then((data) => {
        if (data.authUrl) {
          window.location.href = data.authUrl;
        }
      })
      .catch(() => {
        // Direct fallback: build the URL client-side
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
        if (!clientId) {
          console.error("Google Client ID not configured");
          return;
        }
        const redirectUri = `${window.location.origin}/api/auth/google/callback`;
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: "openid email profile",
          access_type: "offline",
          prompt: "consent",
        });
        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      });
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("reelassati_user");
    localStorage.removeItem("reelassati_token");
    // Also call the logout API to clear cookies
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, signup, googleLogin, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
