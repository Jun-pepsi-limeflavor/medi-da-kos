"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  CATALOG_CATEGORIES,
  CATALOG_PRODUCTS,
  type CatalogProduct,
} from "@/lib/landing/catalog-products";
import { trackLandingEvent } from "@/lib/analytics";
import { shouldReduceLandingMotion } from "@/lib/landing/motion";
import type { LandingCatalogItem } from "@/lib/landing/types";
import { ConsultationForm } from "./ConsultationForm";
import { LandingSignals } from "./LandingSignals";
import { SpecularButton } from "./SpecularButton";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h3 className="font-semibold text-slate-900">{label}</h3>
      <p className="mt-1 whitespace-pre-line">{value}</p>
    </div>
  );
}

export function CatalogLanding() {
  const [category, setCategory] = useState<CatalogProduct["category"]>("serum");
  const [detail, setDetail] = useState<CatalogProduct | null>(null);
  const [selected, setSelected] = useState<LandingCatalogItem[]>([]);
  const [form, setForm] = useState(false);
  const [formItems, setFormItems] = useState<LandingCatalogItem[] | null>(null);
  const [notice, setNotice] = useState("");
  const landingRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const categoryTimeline = useRef<gsap.core.Timeline | null>(null);
  const dialogExitTimeline = useRef<gsap.core.Timeline | null>(null);
  const products = useMemo(
    () => CATALOG_PRODUCTS.filter((item) => item.category === category),
    [category],
  );

  useEffect(() => {
    if (shouldReduceLandingMotion() || !landingRef.current) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        "[data-catalog-intro]",
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" },
      );
      gsap.fromTo(
        "[data-catalog-tab]",
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.06, delay: 0.12, ease: "power2.out" },
      );
    }, landingRef);
    return () => context.revert();
  }, []);

  useEffect(() => {
    trackLandingEvent("catalog_category_view", "catalog", { catalog_category: category });
  }, []);

  useEffect(() => {
    if (shouldReduceLandingMotion() || !gridRef.current) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        "[data-catalog-tile]",
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.34, stagger: 0.035, ease: "power2.out", clearProps: "transform,visibility" },
      );
    }, gridRef);
    return () => context.revert();
  }, [category]);

  useEffect(() => {
    if (!selected.length || shouldReduceLandingMotion() || !trayRef.current) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        trayRef.current,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.28, ease: "power2.out", clearProps: "transform,visibility" },
      );
    }, trayRef);
    return () => context.revert();
  }, [selected.length]);

  useEffect(() => {
    if (!detail || shouldReduceLandingMotion() || !dialogRef.current) return;
    const context = gsap.context(() => {
      gsap.fromTo("[data-catalog-dialog-backdrop]", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18 });
      gsap.fromTo(
        "[data-catalog-dialog-panel]",
        { autoAlpha: 0, y: 18, scale: 0.985 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.26, delay: 0.04, ease: "power2.out" },
      );
    }, dialogRef);
    return () => context.revert();
  }, [detail]);

  useEffect(
    () => () => {
      categoryTimeline.current?.kill();
      dialogExitTimeline.current?.kill();
    },
    [],
  );

  const selectProduct = (product: CatalogProduct): LandingCatalogItem[] | null => {
    if (selected.some((item) => item.id === product.id)) return selected;
    if (selected.length >= 5) {
      setNotice("You can add up to 5 products to one consultation.");
      return null;
    }
    const next = [...selected, { id: product.id, name: product.name, category: product.category }];
    setSelected(next);
    setNotice("");
    trackLandingEvent("catalog_product_select", "catalog", {
      product_id: product.id,
      catalog_category: product.category,
      cart_size: next.length,
    });
    return next;
  };

  function changeCategory(nextCategory: CatalogProduct["category"]) {
    if (nextCategory === category) return;
    trackLandingEvent("catalog_category_view", "catalog", { catalog_category: nextCategory });
    if (shouldReduceLandingMotion() || !gridRef.current) {
      setCategory(nextCategory);
      return;
    }
    categoryTimeline.current?.kill();
    categoryTimeline.current = gsap.timeline({
      onComplete: () => {
        setCategory(nextCategory);
        categoryTimeline.current = null;
      },
    });
    categoryTimeline.current.to(
      gridRef.current.querySelectorAll("[data-catalog-tile]"),
      { autoAlpha: 0, y: 10, duration: 0.16, stagger: 0.018, ease: "power1.in" },
    );
  }

  function closeDetail() {
    if (!detail || shouldReduceLandingMotion() || !dialogRef.current) {
      setDetail(null);
      return;
    }
    dialogExitTimeline.current?.kill();
    const panel = dialogRef.current.querySelector("[data-catalog-dialog-panel]");
    const backdrop = dialogRef.current.querySelector("[data-catalog-dialog-backdrop]");
    dialogExitTimeline.current = gsap
      .timeline({ onComplete: () => setDetail(null) })
      .to(panel, { autoAlpha: 0, y: 10, scale: 0.99, duration: 0.16, ease: "power1.in" })
      .to(backdrop, { autoAlpha: 0, duration: 0.14 }, "<");
  }

  if (form) {
    return (
      <ConsultationForm
        variant="catalog"
        catalogItems={formItems ?? selected}
        onBack={() => { setForm(false); setFormItems(null); }}
      />
    );
  }

  return (
    <section ref={landingRef}>
      <LandingSignals variant="catalog" />
      <div className="max-w-3xl" data-catalog-intro>
        <p className="text-sm font-semibold uppercase tracking-[.2em] text-sky-700">Private label catalog</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Start with a formula your brand can make its own.</h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">Explore selected Korean beauty concepts, then send the items you want to discuss to our manufacturing team.</p>
      </div>
      <div className="mt-10 border-b border-stone-200" role="tablist" aria-label="Catalog categories">
        {CATALOG_CATEGORIES.map((item) => (
          <button key={item} data-catalog-tab role="tab" aria-selected={item === category} onClick={() => changeCategory(item)} className={`relative mr-6 px-1 pb-4 text-sm font-semibold capitalize ${item === category ? "text-slate-950 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-sky-600" : "text-slate-500 hover:text-slate-900"}`}>
            {item}
          </button>
        ))}
      </div>
      <div ref={gridRef} className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product, index) => (
          <article key={product.id} data-catalog-tile className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white">
            <button type="button" onClick={() => { setDetail(product); trackLandingEvent("catalog_product_view", "catalog", { product_id: product.id, catalog_category: product.category }); }} className="flex flex-1 flex-col w-full text-left">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100"><Image src={product.image} alt="" fill unoptimized priority={index === 0} className="object-cover object-center" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" /></div>
              <div className="flex flex-1 flex-col p-5"><p className="text-xs font-medium uppercase tracking-wide text-sky-700">{product.category}</p><h2 className="mt-2 font-semibold leading-snug">{product.name}</h2><p className="mt-2 line-clamp-2 text-sm text-slate-600">{product.description}</p></div>
            </button>
            <div className="mt-auto px-5 pb-5"><button type="button" onClick={() => { selectProduct(product); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50">Add to consultation</button></div>
          </article>
        ))}
      </div>
      <aside ref={trayRef} className="sticky bottom-3 mt-10 rounded-2xl border border-white/[.44] bg-white/[.48] p-4 shadow-[0_4px_30px_rgba(0,0,0,0.1)] backdrop-blur-[4.9px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><strong>{selected.length} item{selected.length === 1 ? "" : "s"} selected</strong>{selected.length > 0 ? <div className="mt-1 flex flex-wrap gap-2">{selected.map((item) => <button type="button" onClick={() => setSelected((items) => { const next = items.filter((selectedItem) => selectedItem.id !== item.id); trackLandingEvent("catalog_product_remove", "catalog", { product_id: item.id, cart_size: next.length }); return next; })} key={item.id} className="rounded-full bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">{item.name} ×</button>)}</div> : <p className="mt-1 text-sm text-slate-600">Add at least one product to start a consultation.</p>}</div>
          <SpecularButton
            data-catalog-consultation-cta
            data-cta="request_consultation"
            disabled={selected.length === 0}
            onClick={() => {
              trackLandingEvent("cta_click", "catalog", { cta_id: "request_consultation" });
              setFormItems(selected);
              setForm(true);
            }}
            size="sm"
            radius={8}
            textColor="#f8fafc"
            lineColor="#e0f2fe"
            baseColor="#475569"
            intensity={1.7}
            shineSize={22}
            shineFade={58}
            proximity={420}
            followMouse
          >
            Request a consultation
          </SpecularButton>
        </div>
        {notice && <p className="mt-2 text-sm text-red-700" role="status">{notice}</p>}
      </aside>
      {detail && (
        <div ref={dialogRef} className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={detail.name}>
          <div data-catalog-dialog-backdrop className="absolute inset-0 bg-slate-950/40" aria-hidden />
          <div data-catalog-dialog-panel className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex justify-between gap-4"><div><p className="text-sm capitalize text-sky-700">{detail.category}</p><h2 className="mt-1 text-2xl font-semibold">{detail.name}</h2></div><button type="button" onClick={closeDetail} className="rounded p-2 text-slate-600 hover:bg-slate-100" aria-label="Close product details">×</button></div>
            <div className="mt-5 grid gap-4 text-sm leading-relaxed text-slate-700"><Detail label="Description" value={detail.description} /><Detail label="What makes it different" value={detail.differentiators} /><Detail label="Technology" value={detail.technology} /><Detail label="Key ingredients" value={detail.keyIngredients} /><Detail label="How to use" value={detail.howToUse} /></div>
            <div className="mt-6 flex gap-3"><button type="button" onClick={() => { const next = selectProduct(detail); if (next) { setFormItems(next); setForm(true); } }} className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Discuss this product</button><button type="button" onClick={() => { selectProduct(detail); }} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">Add to consultation</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
