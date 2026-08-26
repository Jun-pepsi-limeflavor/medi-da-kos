"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const cred = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      const idToken = await cred.user.getIdToken();

      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (res.status === 403) {
        setError("이 계정은 백오피스 접근 권한이 없습니다.");
        return;
      }
      if (!res.ok) {
        setError("로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      router.replace("/admin");
    } catch {
      setError("로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">Medidakos 백오피스</h1>
          <p className="mt-1 text-xs text-neutral-500">회사 계정으로 로그인하세요</p>
        </div>

        <button
          type="button"
          onClick={signIn}
          disabled={busy}
          className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {busy ? "로그인 중…" : "Google 계정으로 로그인"}
        </button>

        {error && (
          <p role="alert" className="text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
