"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TOP_PRODUCTS } from "@/lib/products";
import { REDIRECT_AFTER_SAMPLE_REQUEST } from "@/lib/routes";
import type { TopProduct } from "@/lib/types";
import { SampleRequestModal } from "./SampleRequestModal";

interface Props {
  uid: string;
  /** Step 1: small peek strip — first row barely visible */
  compact?: boolean;
}

export function Top10Products({ uid, compact = false }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<TopProduct | null>(null);

  if (compact) {
    return (
      <section className="relative mt-4 shrink-0 border-t border-slate-100 pt-4">
        <div className="mb-3 flex items-baseline justify-between gap-2 px-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Top 10 formulas
          </h2>
          <span className="text-xs text-slate-400">Scroll for more →</span>
        </div>

        <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 scroll-smooth [scrollbar-width:thin]">
          {TOP_PRODUCTS.map((product) => (
            <article
              key={product.id}
              className="w-[calc((100%-3rem)/5)] min-w-[148px] max-w-[220px] shrink-0 snap-start cursor-pointer overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition hover:border-sky-200 hover:shadow-md sm:min-w-[160px]"
              onClick={() => setSelected(product)}
              onKeyDown={(e) => e.key === "Enter" && setSelected(product)}
              role="button"
              tabIndex={0}
            >
              <div className="relative aspect-[4/5] overflow-hidden rounded-t-xl bg-gradient-to-br from-sky-50 to-cyan-50">
                <Image
                  src={product.image}
                  alt={product.nameEn}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1280px) 20vw, 200px"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                  }}
                />
                <span className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white shadow-sm">
                  {product.rank}
                </span>
              </div>
              <div className="px-2.5 py-2">
                <p className="line-clamp-2 text-xs font-medium leading-snug text-slate-800">
                  {product.nameEn}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {product.volume}
                </p>
              </div>
            </article>
          ))}
        </div>

        {selected && (
          <SampleRequestModal
            product={selected}
            uid={uid}
            onClose={() => setSelected(null)}
            onSuccess={() => {
              setSelected(null);
              router.push(REDIRECT_AFTER_SAMPLE_REQUEST);
            }}
          />
        )}
      </section>
    );
  }

  return (
    <section className="mt-10 border-t border-slate-100 pt-10">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-800">
          Top 10 Best-Selling Formulas
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Popular Korean ODM references — request a sample with one click.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {TOP_PRODUCTS.map((product) => (
          <article
            key={product.id}
            className="group cursor-pointer overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition hover:border-sky-200 hover:shadow-md"
            onClick={() => setSelected(product)}
            onKeyDown={(e) => e.key === "Enter" && setSelected(product)}
            role="button"
            tabIndex={0}
          >
            <div className="relative aspect-square overflow-hidden rounded-t-xl bg-gradient-to-br from-sky-50 to-cyan-50">
              <Image
                src={product.image}
                alt={product.nameEn}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, 20vw"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
              <span className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white shadow-sm">
                {product.rank}
              </span>
            </div>
            <div className="p-3">
              <p className="line-clamp-2 text-xs font-medium text-slate-800">
                {product.nameEn}
              </p>
              <p className="mt-1 text-xs text-slate-400">{product.volume}</p>
            </div>
          </article>
        ))}
      </div>

      {selected && (
        <SampleRequestModal
          product={selected}
          uid={uid}
          onClose={() => setSelected(null)}
          onSuccess={() => {
            setSelected(null);
            router.push(REDIRECT_AFTER_SAMPLE_REQUEST);
          }}
        />
      )}
    </section>
  );
}
