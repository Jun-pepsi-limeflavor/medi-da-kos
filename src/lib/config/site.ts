export const SITE_URL = "https://www.medidakos.com";

export const SITE_NAME = "Medidakos";

export const SUPPORT_EMAIL = "support@medidakos.com";

/** Display format for the US support line */
export const SUPPORT_PHONE = "+1 (646) 647-3239";

/** E.164 for tel: links */
export const SUPPORT_PHONE_HREF = "tel:+16466473239";

export type SocialPlatform = "linkedin" | "facebook" | "instagram" | "tiktok";

export const SOCIAL_LINKS: ReadonlyArray<{
  name: string;
  href: string;
  platform: SocialPlatform;
}> = [
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/medi-da-kos/",
    platform: "linkedin",
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61592537744735",
    platform: "facebook",
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/medidakos/",
    platform: "instagram",
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@medidakos",
    platform: "tiktok",
  },
];
