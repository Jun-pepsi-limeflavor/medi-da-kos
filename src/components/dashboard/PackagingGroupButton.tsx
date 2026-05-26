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
 * Mid-category list card — cropped hero image (Step 1 feel), label on gradient.
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
      className={`group relative w-full overflow-hidden rounded-2xl border-2 text-left transition duration-300 ${
        selected
          ? "border-sky-500 shadow-lg shadow-sky-200/50 ring-2 ring-sky-200"
          : "border-slate-200/90 bg-white hover:border-sky-200 hover:shadow-md"
      }`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-slate-100 to-sky-50/80 sm:aspect-[5/4] sm:min-h-[7.75rem]">
        <Image
          src={imageSrc}
          alt=""
          fill
          unoptimized
          priority={priority}
          className="object-cover object-[center_70%] scale-[1.0] transition duration-500 ease-out group-hover:scale-[1.2]"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-slate-900/25 to-slate-900/5"
          aria-hidden
        />
        <div
          className={`absolute inset-0 transition duration-300 ${
            selected
              ? "bg-sky-500/25 mix-blend-multiply"
              : "bg-transparent group-hover:bg-slate-900/10"
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
