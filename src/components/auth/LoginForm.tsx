"use client";

// Log In·Sign Up 공통 인증 폼.
// - 이메일·비밀번호 로그인, 회원가입, Google 로그인(기존 useAuth 함수 사용)
// - 필드 오류는 입력창 아래, 인증 오류는 FormMessage로 표시
// - 성공하면 지정 경로로 이동, 이미 로그인된 상태면 리다이렉트
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/lib/auth/auth-context";
import { describeAuthError, logAuthError } from "@/lib/auth/auth-errors";
import { MOCK_ADMIN } from "@/lib/auth/mock-auth";
import {
  validateAuthField,
  validateAuthForm,
  type AuthField,
  type AuthMode,
} from "@/lib/auth/validation";
import {
  REDIRECT_AFTER_LOGIN,
  REDIRECT_AFTER_REGISTER,
  ROUTES,
} from "@/lib/config/routes";

/**
 * Log In (/login) and Sign Up (/signup). Figma: "Log In — Final Design" / "Sign Up — Final Design".
 * Auth logic is unchanged (useAuth login · register · loginWithGoogle); only the UI follows the new design.
 */
type Mode = AuthMode;
type Field = AuthField;

const COPY = {
  login: {
    title: "Welcome back",
    description: "Sign in to track your product development.",
    submit: "Log in",
    switchQuestion: "Don't have an account?",
    switchLabel: "Sign up",
    switchHref: ROUTES.signup,
  },
  register: {
    title: "Create your account",
    description: "Sign up to start your product development journey with Medidakos.",
    submit: "Create account",
    switchQuestion: "Already have an account?",
    switchLabel: "Log in",
    switchHref: ROUTES.login,
  },
} as const;

export function LoginForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { user, loading, isMockMode, login, register, loginWithGoogle } =
    useAuth();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [companyName, setCompanyName] = useState("");

  const copy = COPY[mode];

  // Already logged in while on /login or /signup → REDIRECT_AFTER_LOGIN (lib/config/routes.ts)
  useEffect(() => {
    if (!loading && user) router.replace(REDIRECT_AFTER_LOGIN);
  }, [user, loading, router]);

  /** While a field shows an error, re-check it on every edit so the message updates or clears. */
  function updateFieldError(field: Field, value: string) {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: validateAuthField(field, value) } : prev));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // All checks render in the Figma Input Field Error state (no native browser popups; form is noValidate).
    const errors = validateAuthForm(mode, { displayName, phone, country, email, password });
    setFieldErrors(errors);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      document.getElementById(`auth-${firstInvalid}`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
        router.push(REDIRECT_AFTER_LOGIN);
      } else {
        await register({
          email: email.trim(),
          password,
          displayName,
          phone,
          country,
          companyName: companyName.trim(),
        });
        // Sign up → home (see REDIRECT_AFTER_REGISTER in lib/config/routes.ts)
        router.push(REDIRECT_AFTER_REGISTER);
      }
    } catch (err) {
      logAuthError(mode === "login" ? "login" : "sign-up", err);
      setError(describeAuthError(err).message ?? "");
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
      // A popup the user closed is not an error: describeAuthError returns no message for it.
      const { message } = describeAuthError(err);
      if (message) logAuthError("google", err);
      setError(message ?? "");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="pt-10 text-mdk-body text-mdk-charcoal-muted">Loading…</p>;
  }

  return (
    <div className="flex h-fit w-full max-w-[560px] flex-col gap-8 rounded-mdk-lg border border-mdk-light-gray bg-mdk-white p-5 sm:p-14">
      <div className="flex flex-col gap-3">
        <h1 className="text-mdk-heading text-mdk-charcoal max-sm:text-[32px] max-sm:leading-[38px]">{copy.title}</h1>
        <p className="text-mdk-body text-mdk-charcoal-muted">{copy.description}</p>
      </div>

      {isMockMode && (
        // Development aid only (NEXT_PUBLIC_USE_MOCK_AUTH): never shown with real Firebase Auth.
        <div className="rounded-[4px] bg-mdk-off-white px-4 py-3 text-mdk-caption text-mdk-charcoal-muted">
          Local mock mode — admin: {MOCK_ADMIN.email} / {MOCK_ADMIN.password}
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogle}
        disabled={submitting}
        className="flex h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-full bg-mdk-white px-6 text-mdk-label text-mdk-charcoal shadow-[inset_0_0_0_1px_var(--color-mdk-light-gray)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-mdk-light-gray" />
        <span className="text-mdk-caption text-mdk-charcoal-muted">or</span>
        <span className="h-px flex-1 bg-mdk-light-gray" />
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
        <div className="flex flex-col gap-5">
          {mode === "register" && (
            <>
              <Input
                id="auth-displayName"
                label="Full name *"
                autoComplete="name"
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); updateFieldError("displayName", e.target.value); }}
                required
                error={fieldErrors.displayName}
              />
              <Input
                id="auth-phone"
                label="Phone number *"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); updateFieldError("phone", e.target.value); }}
                required
                error={fieldErrors.phone}
              />
              <Input
                id="auth-country"
                label="Country *"
                autoComplete="country-name"
                value={country}
                onChange={(e) => { setCountry(e.target.value); updateFieldError("country", e.target.value); }}
                required
                error={fieldErrors.country}
              />
              <Input
                id="auth-companyName"
                label="Company name (optional)"
                autoComplete="organization"
                placeholder="Your brand or company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </>
          )}
          <Input
            id="auth-email"
            label="Email *"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); updateFieldError("email", e.target.value); }}
            required
            error={fieldErrors.email}
          />
          <Input
            id="auth-password"
            label="Password *"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => { setPassword(e.target.value); updateFieldError("password", e.target.value); }}
            required
            minLength={8}
            error={fieldErrors.password}
          />
        </div>

        {error ? <FormMessage type="error">{error}</FormMessage> : null}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Please wait…" : copy.submit}
        </Button>
      </form>

      <div className="flex flex-col items-center gap-4">
        <p className="flex gap-1.5 text-mdk-body">
          <span className="text-mdk-charcoal-muted">{copy.switchQuestion}</span>
          <Link
            href={copy.switchHref}
            className="font-medium text-mdk-charcoal underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal"
          >
            {copy.switchLabel}
          </Link>
        </p>
        <Link
          href={ROUTES.home}
          className="text-mdk-label text-mdk-charcoal-muted hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mdk-charcoal"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
