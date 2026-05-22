"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CMBrief,
  FragranceOption,
  PackagingSelection,
  ProductCategory,
} from "@/lib/types";
import {
  getPackagingGroups,
  getPackagingItems,
} from "@/lib/packaging-options";
import { submitCustomBrief } from "@/lib/firestore-service";
import { useDashboardBrief } from "@/lib/dashboard-brief-context";
import { Top10Products } from "./Top10Products";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

interface Props {
  uid: string;
}

export function CMWizard({ uid }: Props) {
  const router = useRouter();
  const { brief, loading, setBrief, persistBrief } = useDashboardBrief();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function persist(next: CMBrief, advance = false) {
    setSaving(true);
    const updated = await persistBrief(next, advance);
    setSaving(false);
    setMessage(
      advance
        ? "Saved. Continuing to next step."
        : next.status === "submitted"
          ? "Brief submitted. View it in My Orders."
          : "Draft saved.",
    );
    setTimeout(() => setMessage(""), 4000);
    return updated;
  }

  async function handleSubmit() {
    if (!brief) return;
    setSaving(true);
    try {
      await submitCustomBrief(brief);
      setBrief({ ...brief, status: "submitted" });
      setMessage("Brief submitted. View it in My Orders.");
      setTimeout(() => router.push("/dashboard/orders"), 1500);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !brief) {
    return <p className="text-slate-500">Loading your custom brief…</p>;
  }

  const step = brief.currentStep;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            Custom Manufacturing Brief
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Step {step} of 6 — complete each section to build your ODM request.
          </p>
        </div>
        {message && (
          <span className="rounded-full bg-emerald-50 px-4 py-1.5 text-sm text-emerald-700">
            {message}
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        {step === 1 && (
          <Step1
            value={brief.step1?.category}
            onChange={(category) =>
              setBrief({ ...brief, step1: { category }, step2: { selections: [] } })
            }
          />
        )}
        {step === 2 && (
          <Step2
            category={brief.step1?.category ?? "skincare"}
            selections={brief.step2?.selections ?? []}
            onChange={(selections) =>
              setBrief({ ...brief, step2: { selections } })
            }
          />
        )}
        {step === 3 && (
          <Step3
            brief={brief}
            onLogo={(logoDataUrl, logoFileName) =>
              setBrief({
                ...brief,
                step3: { ...brief.step3, logoDataUrl, logoFileName },
              })
            }
            onPreviewGroup={(previewGroup) =>
              setBrief({ ...brief, step3: { ...brief.step3, previewGroup } })
            }
          />
        )}
        {step === 4 && (
          <Step4
            value={brief.step4}
            onChange={(step4) => setBrief({ ...brief, step4 })}
          />
        )}
        {step === 5 && (
          <Step5
            value={brief.step5}
            onChange={(step5) => setBrief({ ...brief, step5 })}
          />
        )}
        {step === 6 && (
          <Step6
            value={brief.step6}
            onChange={(step6) => setBrief({ ...brief, step6 })}
          />
        )}

        <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
          {step > 1 && (
            <button
              type="button"
              onClick={() => persist({ ...brief, currentStep: step - 1 }, false)}
              className="rounded-lg border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Back
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => persist(brief, false)}
            className="rounded-lg border border-sky-200 px-5 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-60"
          >
            Save draft
          </button>
          {step < 6 ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => persist(brief, true)}
              className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              Save & continue
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || brief.status === "submitted"}
              onClick={handleSubmit}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {brief.status === "submitted" ? "Already submitted" : "Submit brief"}
            </button>
          )}
        </div>
      </div>

      {step === 1 && <Top10Products uid={uid} />}
    </div>
  );
}

function Step1({
  value,
  onChange,
}: {
  value?: ProductCategory;
  onChange: (c: ProductCategory) => void;
}) {
  const options: { id: ProductCategory; label: string; desc: string }[] = [
    {
      id: "skincare",
      label: "Skin Care",
      desc: "Serums, creams, toners, cleansers, and treatments.",
    },
    {
      id: "cosmetic",
      label: "Cosmetic",
      desc: "Color cosmetics, makeup, and decorative products.",
    },
  ];

  return (
    <div>
      <h2 className="text-lg font-medium text-slate-800">
        Select product category
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Choose the primary category for your custom ODM project.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {options.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            className={`rounded-xl border-2 p-6 text-left transition ${
              value === cat.id
                ? "border-sky-500 bg-sky-50"
                : "border-slate-100 hover:border-sky-200"
            }`}
          >
            <p className="font-semibold text-slate-800">{cat.label}</p>
            <p className="mt-2 text-sm text-slate-500">{cat.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function Step2({
  category,
  selections,
  onChange,
}: {
  category: ProductCategory;
  selections: PackagingSelection[];
  onChange: (s: PackagingSelection[]) => void;
}) {
  const groups = getPackagingGroups(category);

  function toggleItem(group: string, item: string) {
    const existing = selections.find((s) => s.group === group);
    if (!existing) {
      onChange([...selections, { group, items: [item] }]);
      return;
    }
    const has = existing.items.includes(item);
    const newItems = has
      ? existing.items.filter((i) => i !== item)
      : [...existing.items, item];
    if (newItems.length === 0) {
      onChange(selections.filter((s) => s.group !== group));
    } else {
      onChange(
        selections.map((s) =>
          s.group === group ? { group, items: newItems } : s,
        ),
      );
    }
  }

  function isSelected(group: string, item: string) {
    return selections.some(
      (s) => s.group === group && s.items.includes(item),
    );
  }

  return (
    <div>
      <h2 className="text-lg font-medium text-slate-800">Packaging options</h2>
      <p className="mt-1 text-sm text-slate-500">
        Select packaging types and formats for your{" "}
        {category === "skincare" ? "Skin Care" : "Cosmetic"} line.
      </p>
      <div className="mt-6 space-y-8">
        {groups.map((group) => (
          <div key={group}>
            <h3 className="text-sm font-semibold text-slate-700">{group}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {getPackagingItems(category, group).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleItem(group, item)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    isSelected(group, item)
                      ? "border-sky-500 bg-sky-50 text-sky-800"
                      : "border-slate-200 text-slate-600 hover:border-sky-200"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step3({
  brief,
  onLogo,
  onPreviewGroup,
}: {
  brief: CMBrief;
  onLogo: (dataUrl: string, fileName: string) => void;
  onPreviewGroup: (group: string) => void;
}) {
  const groups = brief.step2?.selections?.map((s) => s.group) ?? [];

  return (
    <div>
      <h2 className="text-lg font-medium text-slate-800">
        Logo & packaging preview
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Upload your logo and preview it on selected packaging groups.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Upload logo
          </label>
          <input
            type="file"
            accept="image/*"
            className="text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () =>
                onLogo(reader.result as string, file.name);
              reader.readAsDataURL(file);
            }}
          />
          {brief.step3?.logoDataUrl && (
            <img
              src={brief.step3.logoDataUrl}
              alt="Logo preview"
              className="mt-4 max-h-24 object-contain"
            />
          )}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Preview on packaging group
          </label>
          <div className="flex flex-wrap gap-2">
            {groups.length === 0 ? (
              <p className="text-sm text-slate-400">
                Select packaging in Step 2 first.
              </p>
            ) : (
              groups.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onPreviewGroup(g)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    brief.step3?.previewGroup === g
                      ? "border-sky-500 bg-sky-50"
                      : "border-slate-200"
                  }`}
                >
                  {g}
                </button>
              ))
            )}
          </div>
          <div className="mt-4 flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-sky-100 bg-gradient-to-br from-sky-50 to-white">
            {brief.step3?.logoDataUrl ? (
              <div className="text-center">
                <img
                  src={brief.step3.logoDataUrl}
                  alt=""
                  className="mx-auto max-h-20 object-contain"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {brief.step3.previewGroup ?? "packaging"} preview
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Logo preview area</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step4({
  value,
  onChange,
}: {
  value?: CMBrief["step4"];
  onChange: (v: NonNullable<CMBrief["step4"]>) => void;
}) {
  const v = value ?? {
    volume: "",
    unit: "ml" as const,
    moq: "",
    sampleRequestDate: "",
    targetLaunchDate: "",
    shippingCountry: "",
  };
  const set = (patch: Partial<typeof v>) => onChange({ ...v, ...patch });

  return (
    <div>
      <h2 className="text-lg font-medium text-slate-800">Volume, MOQ & timeline</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Volume</label>
          <input className={inputClass} value={v.volume} onChange={(e) => set({ volume: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Unit</label>
          <select className={inputClass} value={v.unit} onChange={(e) => set({ unit: e.target.value as "ml" | "g" | "oz" })}>
            <option value="ml">ml</option>
            <option value="g">g</option>
            <option value="oz">oz</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">MOQ</label>
          <input className={inputClass} value={v.moq} onChange={(e) => set({ moq: e.target.value })} placeholder="e.g. 3,000 units" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Sample request date</label>
          <input type="date" className={inputClass} value={v.sampleRequestDate} onChange={(e) => set({ sampleRequestDate: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Target launch date</label>
          <input type="date" className={inputClass} value={v.targetLaunchDate} onChange={(e) => set({ targetLaunchDate: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Shipping country</label>
          <input className={inputClass} value={v.shippingCountry} onChange={(e) => set({ shippingCountry: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

function Step5({
  value,
  onChange,
}: {
  value?: CMBrief["step5"];
  onChange: (v: NonNullable<CMBrief["step5"]>) => void;
}) {
  const v = value ?? {
    fragrance: "unscented" as FragranceOption,
    colorHex: "#7dd3fc",
    viscosity: "",
    textureNotes: "",
    finishNotes: "",
  };
  const set = (patch: Partial<typeof v>) => onChange({ ...v, ...patch });

  return (
    <div>
      <h2 className="text-lg font-medium text-slate-800">Formula preferences</h2>
      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Fragrance</label>
          <select className={inputClass} value={v.fragrance} onChange={(e) => set({ fragrance: e.target.value as FragranceOption })}>
            <option value="green-tea">Green tea</option>
            <option value="hypoallergenic">Hypoallergenic</option>
            <option value="unscented">Unscented</option>
            <option value="fragrance-free">Fragrance-free</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Color</label>
          <input type="color" className="h-10 w-20 cursor-pointer rounded border border-slate-200" value={v.colorHex} onChange={(e) => set({ colorHex: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Viscosity</label>
          <input className={inputClass} value={v.viscosity} onChange={(e) => set({ viscosity: e.target.value })} placeholder="e.g. light gel" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Texture (optional)</label>
          <input className={inputClass} value={v.textureNotes ?? ""} onChange={(e) => set({ textureNotes: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Finish (optional)</label>
          <input className={inputClass} value={v.finishNotes ?? ""} onChange={(e) => set({ finishNotes: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

function Step6({
  value,
  onChange,
}: {
  value?: CMBrief["step6"];
  onChange: (v: NonNullable<CMBrief["step6"]>) => void;
}) {
  const v = value ?? {
    vegan: false,
    functionalClaims: [] as string[],
    conceptIngredients: "",
    restrictedIngredients: "",
    internationalCertifications: [] as string[],
  };
  const set = (patch: Partial<typeof v>) => onChange({ ...v, ...patch });
  const certs = ["FDA", "EU CPNP", "Halal", "Vegan Society", "ISO 22716"];

  return (
    <div>
      <h2 className="text-lg font-medium text-slate-800">Compliance & certifications</h2>
      <div className="mt-6 space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.vegan} onChange={(e) => set({ vegan: e.target.checked })} />
          Vegan formulation required
        </label>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Concept / hero ingredients</label>
          <textarea className={inputClass} rows={3} value={v.conceptIngredients} onChange={(e) => set({ conceptIngredients: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Restricted ingredients</label>
          <textarea className={inputClass} rows={2} value={v.restrictedIngredients} onChange={(e) => set({ restrictedIngredients: e.target.value })} />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">International certifications</p>
          <div className="flex flex-wrap gap-2">
            {certs.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() =>
                  set({
                    internationalCertifications: v.internationalCertifications.includes(c)
                      ? v.internationalCertifications.filter((x) => x !== c)
                      : [...v.internationalCertifications, c],
                  })
                }
                className={`rounded-full border px-3 py-1 text-xs ${
                  v.internationalCertifications.includes(c)
                    ? "border-sky-500 bg-sky-50 text-sky-700"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
