"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/session", { method: "DELETE" });
        router.replace("/admin/login");
      }}
      className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-800"
    >
      로그아웃
    </button>
  );
}
