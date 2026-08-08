import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { platformApi } from "@/lib/platform-api";
import { isVercelClientDeployment, ownerStudioUrl } from "@/lib/runtime";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "owner";
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  enterStudio: () => Promise<boolean>;
  login: () => Promise<boolean>;
  signup: () => Promise<boolean>;
  googleLogin: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(() => !isVercelClientDeployment());
  const [error, setError] = useState<string | null>(null);

  const enterStudio = useCallback(async () => {
    if (isVercelClientDeployment()) {
      window.location.assign(ownerStudioUrl());
      return false;
    }

    setLoading(true);
    setError(null);
    try {
      const session = await platformApi.session();
      setUser({
        id: session.user.email,
        email: session.user.email,
        name: session.user.name,
        role: "owner",
      });
      return true;
    } catch (cause) {
      setUser(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "The authenticated studio session is unavailable"
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isVercelClientDeployment()) {
      return;
    }

    let active = true;
    platformApi
      .session()
      .then(session => {
        if (!active) return;
        setUser({
          id: session.user.email,
          email: session.user.email,
          name: session.user.name,
          role: "owner",
        });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setUser(null);
        setError(
          cause instanceof Error
            ? cause.message
            : "The authenticated studio session is unavailable"
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    window.location.assign("/");
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      enterStudio,
      login: enterStudio,
      signup: enterStudio,
      googleLogin: enterStudio,
      logout,
    }),
    [user, loading, error, enterStudio, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
