type IdentityForDisplay = {
  kind: "email" | "channeltalk";
  value: string;
  displayName?: string;
  displayEmail?: string;
};

export type IdentityDisplay = {
  primary: string;
  secondary?: string;
  email?: string;
};

export function getIdentityDisplay(identity: IdentityForDisplay): IdentityDisplay {
  const email = identity.kind === "email"
    ? identity.value.trim().toLowerCase()
    : identity.displayEmail?.trim().toLowerCase();
  if (email) return { primary: email, email };

  const name = identity.displayName?.trim();
  return {
    primary: name || "채널톡 사용자",
    secondary: "이메일 미제공",
  };
}
