"use client";

import Image from "next/image";
import { useState } from "react";
import { TOP_PRODUCTS } from "@/lib/products";
import type { TopProduct } from "@/lib/types";
import { SampleRequestModal } from "./SampleRequestModal";

interface Props {
  uid: string;
}

export function Top10Products({ uid }: Props) {
  const [selected, setSelected] = useState<TopProduct | null>(null);
  const [toast, setToast] = useState("");

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

      {toast && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {toast}
        </div>
      )}

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
            <div className="relative aspect-square bg-gradient-to-br from-sky-50 to-cyan-50">
              <Image
                src={product.image}
                alt={product.nameEn}
                fill
                className="object-cover p-3"
                sizes="(max-width: 640px) 50vw, 20vw"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
              <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
                {product.rank}
              </span>
            </div>
            <div className="p-3">
              <p className="line-clamp-2 text-xs font-medium text-slate-800">
                {product.nameEn}
              </p>
              <p className="mt-1 text-xs text-slate-400">{product.volume}</p>
              <button
                type="button"
                className="mt-2 w-full rounded-lg bg-slate-900 py-1.5 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(product);
                }}
              >
                Request sample
              </button>
            </div>
          </article>
        ))}
      </div>

      {selected && (
        <SampleRequestModal
          product={selected}
          uid={uid}
          onClose={() => setSelected(null)}
          onSuccess={() =>
            setToast(
              `Sample request submitted for ${selected.nameEn}. We'll confirm shipping details shortly.`,
            )
          }
        />
      )}
    </section>
  );
}
