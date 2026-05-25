"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { MOCK_ADMIN } from "@/lib/mock-store";
import {
  REDIRECT_AFTER_LOGIN,
  REDIRECT_AFTER_REGISTER,
  ROUTES,
} from "@/lib/routes";

type Mode = "login" | "register";

const inputClass =
  "w-full rounded-lg border border-sky-100 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

export function LoginForm() {
  const router = useRouter();
  const { user, loading, isMockMode, login, register, loginWithGoogle } =
    useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [companyName, setCompanyName] = useState("");

  // Already logged in while on /login → send to dashboard (change ROUTES in lib/routes.ts)
  useEffect(() => {
    if (!loading && user) router.replace(REDIRECT_AFTER_LOGIN);
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
        router.push(REDIRECT_AFTER_LOGIN);
      } else {
        if (!displayName || !phone || !country) {
          throw new Error("Please fill in all required registration fields.");
        }
        await register({
          email,
          password,
          displayName,
          phone,
          country,
          companyName: companyName.trim(),
        });
        // Sign up → home (see REDIRECT_AFTER_REGISTER in lib/routes.ts)
        router.push(REDIRECT_AFTER_REGISTER);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setSubmitting(true);
    try {
      await loginWithGoogle();
      router.push(REDIRECT_AFTER_LOGIN);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-2xl font-semibold text-slate-800">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {mode === "login"
          ? "Sign in to manage your custom ODM briefs and orders."
          : "Register to start your custom formulation journey with Korean ODM partners."}
      </p>

      {isMockMode && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Local mock mode active</p>
          <p className="mt-1 text-amber-800">
            Admin: {MOCK_ADMIN.email} / {MOCK_ADMIN.password}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogle}
        disabled={submitting}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-sky-100 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-sky-50 disabled:opacity-60"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-sky-100" />
        <span className="text-xs text-slate-400">or</span>
        <div className="h-px flex-1 bg-sky-100" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Full name *
              </label>
              <input
                className={inputClass}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Phone number *
              </label>
              <input
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Country *
              </label>
              <input
                className={inputClass}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Company name (optional)
              </label>
              <input
                className={inputClass}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your brand or company"
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Email *
          </label>
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Password *
          </label>
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
        >
          {submitting
            ? "Please wait…"
            : mode === "login"
              ? "Log in"
              : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <button
              type="button"
              className="font-medium text-sky-600 hover:underline"
              onClick={() => setMode("register")}
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              className="font-medium text-sky-600 hover:underline"
              onClick={() => setMode("login")}
            >
              Log in
            </button>
          </>
        )}
      </p>

      <p className="mt-4 text-center text-sm">
        <Link href={ROUTES.home} className="text-slate-500 hover:text-sky-600">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
