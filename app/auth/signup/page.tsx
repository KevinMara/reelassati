"use client";

import { useState } from "react";

function errorMessage(code: string) {
  if (code === "email_already_exists") return "This email already has an account.";
  if (code === "invalid_input") return "Check name, email and password. Password must be at least 8 characters.";
  if (code === "auth_schema_error") return "Authentication database is being repaired. Try again in a few seconds.";
  if (code === "auth_database_error") return "Authentication is temporarily unavailable.";
  return "Authentication is temporarily unavailable.";
}

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: any) {
    event.preventDefault();
    setMessage("");

    if (!accepted) {
      setMessage("Accept the terms to continue.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setMessage(errorMessage(data?.error || "unknown_error"));
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setMessage("Network error. Please reload and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#10100f] text-white px-6 py-10">
      <div className="mx-auto max-w-xl">
        <a href="/" className="inline-flex items-center gap-2 text-2xl font-bold">
          <span>⌞</span>
          <span>REEL<span className="italic font-normal">assati</span></span>
        </a>

        <section className="mt-16">
          <h1 className="text-5xl font-bold tracking-tight">Crea il tuo account.</h1>
          <p className="mt-4 text-xl text-neutral-400">Solo è gratis, per sempre.</p>

          <form onSubmit={submit} className="mt-10 rounded-2xl border border-neutral-800 bg-[#1d1b19] p-10 shadow-2xl">
            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-3 w-full rounded-xl bg-black px-5 py-4 text-lg outline-none focus:ring-2 focus:ring-violet-500"
              autoComplete="name"
              required
            />

            <label className="mt-8 block text-xs font-bold uppercase tracking-widest text-neutral-500">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-3 w-full rounded-xl bg-black px-5 py-4 text-lg outline-none focus:ring-2 focus:ring-violet-500"
              autoComplete="email"
              type="email"
              required
            />

            <label className="mt-8 block text-xs font-bold uppercase tracking-widest text-neutral-500">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-3 w-full rounded-xl bg-black px-5 py-4 text-lg outline-none focus:ring-2 focus:ring-violet-500"
              autoComplete="new-password"
              type="password"
              minLength={8}
              required
            />

            <label className="mt-6 flex items-center gap-3 text-neutral-300">
              <input
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                type="checkbox"
                className="h-5 w-5 accent-violet-500"
              />
              <span>Iscrivendoti accetti i Termini e l'Informativa privacy.</span>
            </label>

            {message ? (
              <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-red-200">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-8 w-full rounded-full bg-violet-500 px-6 py-4 text-lg font-semibold text-black disabled:opacity-60"
            >
              {loading ? "Creazione..." : "Crea account"}
            </button>

            <button
              type="button"
              disabled
              className="mt-6 w-full rounded-full border border-neutral-700 px-6 py-4 text-neutral-500"
            >
              Google login non configurato
            </button>

            <p className="mt-8 text-center text-neutral-400">
              Hai già un account? <a className="text-violet-400" href="/auth/login">Accedi</a>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
