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
import posthog from "@/lib/posthog";
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
      const user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: "owner" as const,
      };
      posthog?.identify(user.id, {
        email: user.email,
        name: user.name,
        role: user.role,
      });
      setUser(user);
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
        const user = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: "owner" as const,
        };
        posthog?.identify(user.id, {
          email: user.email,
          name: user.name,
          role: user.role,
        });
        setUser(user);
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
    posthog?.reset();
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
