// Log In 페이지(/login). AuthShell 안에 로그인 폼을 렌더링하며 검색 노출 제외(noindex).
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log in",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return (
    <AuthShell>
      <LoginForm mode="login" />
    </AuthShell>
  );
}
