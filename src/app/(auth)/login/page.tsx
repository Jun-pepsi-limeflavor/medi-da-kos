// Log In 페이지(/login). AuthShell 안에 로그인 폼을 렌더링하며 검색 노출 제외(noindex).
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { LOGIN_METADATA } from "@/lib/config/seo";

// noindex + own canonical; does not inherit the Home description, OG or Twitter tags.
export const metadata = LOGIN_METADATA;

export default function LoginPage() {
  return (
    <AuthShell>
      <LoginForm mode="login" />
    </AuthShell>
  );
}
