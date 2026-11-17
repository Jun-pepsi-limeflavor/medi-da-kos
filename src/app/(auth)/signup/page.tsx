// Sign Up 페이지(/signup). AuthShell 안에 회원가입 폼을 렌더링하며 검색 노출 제외(noindex).
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { SIGNUP_METADATA } from "@/lib/config/seo";

// noindex + own canonical; does not inherit the Home description, OG or Twitter tags.
export const metadata = SIGNUP_METADATA;

export default function SignupPage() {
  return (
    <AuthShell>
      <LoginForm mode="register" />
    </AuthShell>
  );
}
