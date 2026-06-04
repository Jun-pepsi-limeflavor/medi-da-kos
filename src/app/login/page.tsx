import type { Metadata } from "next";
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
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white px-4 py-16">
      <LoginForm />
    </div>
  );
}
