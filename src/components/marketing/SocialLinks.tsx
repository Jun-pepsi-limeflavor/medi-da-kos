import { SOCIAL_LINKS } from "@/lib/site";
import {
  SOCIAL_HOVER_CLASS,
  SOCIAL_ICON_MAP,
} from "@/components/marketing/SocialIcons";

type SocialLinksProps = {
  className?: string;
  showLabel?: boolean;
  label?: string;
  size?: "sm" | "md";
};

const buttonSizeClass = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
} as const;

const iconSizeClass = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
} as const;

export function SocialLinks({
  className = "",
  showLabel = false,
  label = "Follow us",
  size = "sm",
}: SocialLinksProps) {
  return (
    <div className={className}>
      {showLabel ? (
        <p className="mb-3 text-sm font-semibold text-slate-800">{label}</p>
      ) : null}
      <ul className="flex flex-wrap items-center gap-2.5" role="list">
        {SOCIAL_LINKS.map(({ name, href, platform }) => {
          const Icon = SOCIAL_ICON_MAP[platform];
          return (
            <li key={platform}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${name} (opens in new tab)`}
                title={name}
                className={`inline-flex ${buttonSizeClass[size]} items-center justify-center rounded-full border border-sky-100/90 bg-white/90 text-slate-500 shadow-sm shadow-sky-100/40 backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-sky-100/60 ${SOCIAL_HOVER_CLASS[platform]}`}
              >
                <Icon className={iconSizeClass[size]} />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
