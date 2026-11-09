// Sign Up 페이지(/signup). 검색 노출 제외(noindex).
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign up",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignupPage() {
  return <LoginForm mode="register" />;
}
