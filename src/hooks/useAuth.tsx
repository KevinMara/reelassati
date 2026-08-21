import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Provider, User } from "@supabase/supabase-js";
import {
  supabase,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/client";
import posthog from "@/lib/posthog";

export type SocialProvider = "google" | "apple" | "github";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "member";
}

export interface SignupResult {
  signedIn: boolean;
  confirmationRequired: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  availableProviders: SocialProvider[];
  recoverySession: boolean;
  clearError: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<SignupResult>;
  oauthLogin: (provider: SocialProvider) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapUser(user: User | null): AuthUser | null {
  if (!user?.email) return null;
  const fallbackName = user.email.split("@")[0] || "Creator";
  return {
    id: user.id,
    email: user.email,
    name:
      user.user_metadata?.full_name?.trim() ||
      user.user_metadata?.name?.trim() ||
      fallbackName,
    role: "member",
  };
}

function identifyAnalyticsUser(user: AuthUser | null) {
  if (!user) return;
  posthog?.identify(user.id, {
    email: user.email,
    name: user.name,
    role: user.role,
  });
}

function authRedirect(path = "/auth/oauth-success") {
  const configuredOrigin = import.meta.env.VITE_AUTH_REDIRECT_ORIGIN?.trim();
  const hostname = window.location.hostname.toLowerCase();
  const productionOrigin =
    hostname === "reelassati.app" ||
    hostname === "www.reelassati.app" ||
    hostname.endsWith(".vercel.app")
      ? "https://www.reelassati.app"
      : window.location.origin;

  let origin = productionOrigin;
  if (configuredOrigin) {
    try {
      origin = new URL(configuredOrigin).origin;
    } catch {
      // Ignore an invalid build-time override and retain the safe origin.
    }
  }

  return `${origin}/#${path}`;
}

function readableError(cause: unknown) {
  if (!(cause instanceof Error)) return "Authentication is unavailable";
  if (
    /failed to fetch|networkerror|network request failed|load failed/i.test(
      cause.message
    )
  ) {
    return "Account services are temporarily unavailable. Please try again in a moment.";
  }
  if (/invalid login credentials/i.test(cause.message)) {
    return "The email or password is incorrect.";
  }
  if (/email not confirmed/i.test(cause.message)) {
    return "Confirm your email before signing in.";
  }
  if (/user already registered/i.test(cause.message)) {
    return "An account already exists for this email.";
  }
  return cause.message;
}

async function configuredProviders(): Promise<SocialProvider[]> {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabasePublishableKey },
    });
    if (!response.ok) return [];
    const settings = (await response.json()) as {
      external?: Record<string, boolean>;
    };
    return (["google", "apple", "github"] as const).filter(
      provider => settings.external?.[provider]
    );
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<
    SocialProvider[]
  >([]);
  const [recoverySession, setRecoverySession] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      supabase.auth.getSession(),
      configuredProviders(),
    ]).then(([sessionResult, providersResult]) => {
      if (!active) return;
      if (sessionResult.status === "fulfilled") {
        const mappedUser = mapUser(
          sessionResult.value.data.session?.user ?? null
        );
        identifyAnalyticsUser(mappedUser);
        setUser(mappedUser);
      }
      if (providersResult.status === "fulfilled") {
        setAvailableProviders(providersResult.value);
      }
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setRecoverySession(true);
      if (event === "SIGNED_OUT") setRecoverySession(false);
      const mappedUser = mapUser(session?.user ?? null);
      identifyAnalyticsUser(mappedUser);
      setUser(mappedUser);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email: email.trim(),
          password,
        }
      );
      if (authError) throw authError;
      const mappedUser = mapUser(data.user);
      identifyAnalyticsUser(mappedUser);
      setUser(mappedUser);
      return Boolean(data.session);
    } catch (cause) {
      setError(readableError(cause));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: authError } = await supabase.auth.signUp({
          email: input.email.trim(),
          password: input.password,
          options: {
            data: { full_name: input.name.trim() },
            emailRedirectTo: authRedirect(),
          },
        });
        if (authError) throw authError;
        const mappedUser = mapUser(data.user);
        identifyAnalyticsUser(mappedUser);
        setUser(mappedUser);
        return {
          signedIn: Boolean(data.session),
          confirmationRequired: Boolean(data.user && !data.session),
        };
      } catch (cause) {
        setError(readableError(cause));
        return { signedIn: false, confirmationRequired: false };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const oauthLogin = useCallback(async (provider: SocialProvider) => {
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: provider as Provider,
        options: { redirectTo: authRedirect() },
      });
      if (authError) throw authError;
      return true;
    } catch (cause) {
      setError(readableError(cause));
      setLoading(false);
      return false;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: authRedirect("/auth/update-password") }
      );
      if (authError) throw authError;
      return true;
    } catch (cause) {
      setError(readableError(cause));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      return true;
    } catch (cause) {
      setError(readableError(cause));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    await supabase.auth.signOut();
    posthog?.reset();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      availableProviders,
      recoverySession,
      clearError,
      login,
      signup,
      oauthLogin,
      resetPassword,
      updatePassword,
      logout,
    }),
    [
      user,
      loading,
      error,
      availableProviders,
      recoverySession,
      clearError,
      login,
      signup,
      oauthLogin,
      resetPassword,
      updatePassword,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
