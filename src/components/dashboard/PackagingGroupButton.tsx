"use client";

import Image from "next/image";

interface Props {
  label: string;
  imageSrc: string;
  selected: boolean;
  onClick: () => void;
  /** First visible row — eager load for LCP (Next.js `priority`) */
  priority?: boolean;
}

/**
 * Step 2 category card tuned for 2:3 source images.
 */
export function PackagingGroupButton({
  label,
  imageSrc,
  selected,
  onClick,
  priority = false,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative w-full overflow-hidden rounded-xl border-2 text-left transition duration-300 ${
        selected
          ? "border-sky-400 shadow-md shadow-sky-100/70 ring-1 ring-sky-200/70"
          : "border-slate-200/90 bg-white hover:border-sky-200 hover:shadow-md"
      }`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-gradient-to-br from-sky-100/70 to-sky-50/40">
        <Image
          src={imageSrc}
          alt=""
          fill
          priority={priority}
          className="object-cover object-center scale-[1.06] transition duration-500 ease-out group-hover:scale-[1.16]"
          sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 18vw"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-slate-900/45 via-slate-900/10 to-transparent"
          aria-hidden
        />
        <div
          className={`absolute inset-0 transition duration-300 ${
            selected
              ? "bg-sky-400/18 mix-blend-multiply"
              : "bg-transparent group-hover:bg-sky-900/6"
          }`}
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3.5 pt-10">
          <p
            className={`text-base font-semibold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] sm:text-lg ${
              selected ? "text-sky-50" : ""
            }`}
          >
            {label}
          </p>
        </div>
        {selected && (
          <span
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-white shadow-md"
            aria-hidden
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </span>
        )}
      </div>
    </button>
  );
}
