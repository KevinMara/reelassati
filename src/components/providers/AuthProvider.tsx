'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type AuthState = "loading" | "loggedIn" | "loggedOut";

type AuthContextType = {
  state: AuthState;
  profile: any | null;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>("loading");
  const [profile, setProfile] = useState<any | null>(null);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();

      if (data.ok && data.user) {
        setProfile(data.user);
        setState("loggedIn");
      } else {
        setProfile(null);
        setState("loggedOut");
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      setProfile(null);
      setState("loggedOut");
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setProfile(null);
      setState("loggedOut");
    }
  };

  return (
    <AuthContext.Provider value={{ state, profile, logout, refresh: checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
