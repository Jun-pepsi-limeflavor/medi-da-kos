// Sign Up 페이지(/signup). AuthShell 안에 회원가입 폼을 렌더링하며 검색 노출 제외(noindex).
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign up",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignupPage() {
  return (
    <AuthShell>
      <LoginForm mode="register" />
    </AuthShell>
  );
}
