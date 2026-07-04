import { createContext, useContext, useState, useCallback } from "react";

interface AuthUser {
  name: string;
  email: string;
}

interface AuthCtx {
  user: AuthUser | null;
  login: (email: string, password: string) => boolean;
  signup: (name: string, email: string, password: string) => boolean;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem("reelassati_user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = useCallback((email: string, password: string) => {
    const users = JSON.parse(localStorage.getItem("reelassati_users") || "[]");
    const found = users.find((u: any) => u.email === email && u.password === password);
    if (found) {
      const u = { name: found.name, email: found.email };
      setUser(u);
      localStorage.setItem("reelassati_user", JSON.stringify(u));
      return true;
    }
    return false;
  }, []);

  const signup = useCallback((name: string, email: string, password: string) => {
    const users = JSON.parse(localStorage.getItem("reelassati_users") || "[]");
    if (users.find((u: any) => u.email === email)) return false;
    users.push({ name, email, password });
    localStorage.setItem("reelassati_users", JSON.stringify(users));
    const u = { name, email };
    setUser(u);
    localStorage.setItem("reelassati_user", JSON.stringify(u));
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("reelassati_user");
  }, []);

  return <Ctx.Provider value={{ user, login, signup, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
