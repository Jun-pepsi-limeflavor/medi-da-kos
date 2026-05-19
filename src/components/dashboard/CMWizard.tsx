"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CMBrief,
  PackagingType,
  ProductCategory,
  FragranceOption,
} from "@/lib/types";
import { loadCMBrief, saveCMBrief } from "@/lib/firestore-service";
import { Top10Products } from "./Top10Products";

const PACKAGING_OPTIONS: { id: PackagingType; label: string }[] = [
  { id: "bottle", label: "Bottle" },
  { id: "tube", label: "Tube" },
  { id: "jar", label: "Jar" },
  { id: "closure", label: "Closure" },
  { id: "makeup", label: "Makeup" },
  { id: "stick", label: "Stick" },
  { id: "kolmar-exclusive", label: "Kolmar Exclusive" },
  { id: "accessory", label: "Accessory" },
];

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

interface Props {
  uid: string;
  onStepChange?: (step: number) => void;
}

export function CMWizard({ uid, onStepChange }: Props) {
  const [brief, setBrief] = useState<CMBrief | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const data = await loadCMBrief(uid);
    setBrief(data);
    onStepChange?.(data.currentStep);
  }, [uid, onStepChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function persist(next: CMBrief, advance = false) {
    setSaving(true);
    const updated = {
      ...next,
      updatedAt: new Date().toISOString(),
      currentStep: advance
        ? Math.min(6, next.currentStep + 1)
        : next.currentStep,
    };
    await saveCMBrief(updated);
    setBrief(updated);
    onStepChange?.(updated.currentStep);
    setSaving(false);
    setMessage(advance ? "Saved. Continuing to next step." : "Draft saved.");
    setTimeout(() => setMessage(""), 3000);
  }

  if (!brief) {
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
              setBrief({ ...brief, step1: { category } })
            }
          />
        )}
        {step === 2 && (
          <Step2
            selected={brief.step2?.packaging ?? []}
            onChange={(packaging) =>
              setBrief({ ...brief, step2: { packaging } })
            }
          />
        )}
        {step === 3 && (
          <Step3
            brief={brief}
            onLogo={(logoDataUrl, logoFileName) =>
              setBrief({
                ...brief,
                step3: {
                  ...brief.step3,
                  logoDataUrl,
                  logoFileName,
                },
              })
            }
            onPackaging={(previewPackaging) =>
              setBrief({
                ...brief,
                step3: { ...brief.step3, previewPackaging },
              })
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
              onClick={() =>
                persist({ ...brief, currentStep: step - 1 }, false)
              }
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
              disabled={saving}
              onClick={() =>
                persist({ ...brief, status: "submitted" }, false)
              }
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Submit brief
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
  return (
    <div>
      <h2 className="text-lg font-medium text-slate-800">
        Select product category
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Choose the primary category for your custom ODM project.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {(["skincare", "makeup"] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            className={`rounded-xl border-2 p-6 text-left transition ${
              value === cat
                ? "border-sky-500 bg-sky-50"
                : "border-slate-100 hover:border-sky-200"
            }`}
          >
            <p className="font-semibold capitalize text-slate-800">{cat}</p>
            <p className="mt-2 text-sm text-slate-500">
              {cat === "skincare"
                ? "Serums, creams, toners, cleansers, and treatments."
                : "Color cosmetics, bases, and decorative products."}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function Step2({
  selected,
  onChange,
}: {
  selected: PackagingType[];
  onChange: (p: PackagingType[]) => void;
}) {
  function toggle(id: PackagingType) {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  }
  return (
    <div>
      <h2 className="text-lg font-medium text-slate-800">Packaging types</h2>
      <p className="mt-1 text-sm text-slate-500">
        Select all packaging formats you are considering (8 types).
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PACKAGING_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            className={`rounded-xl border-2 px-4 py-4 text-sm font-medium transition ${
              selected.includes(opt.id)
                ? "border-sky-500 bg-sky-50 text-sky-800"
                : "border-slate-100 text-slate-600 hover:border-sky-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Step3({
  brief,
  onLogo,
  onPackaging,
}: {
  brief: CMBrief;
  onLogo: (dataUrl: string, fileName: string) => void;
  onPackaging: (p: PackagingType) => void;
}) {
  const packaging = brief.step2?.packaging ?? [];

  return (
    <div>
      <h2 className="text-lg font-medium text-slate-800">
        Logo & packaging preview
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Upload your logo and preview it on selected packaging.
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
            Preview on packaging
          </label>
          <div className="flex flex-wrap gap-2">
            {packaging.length === 0 ? (
              <p className="text-sm text-slate-400">
                Select packaging in Step 2 first.
              </p>
            ) : (
              packaging.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPackaging(p)}
                  className={`rounded-lg border px-3 py-2 text-sm capitalize ${
                    brief.step3?.previewPackaging === p
                      ? "border-sky-500 bg-sky-50"
                      : "border-slate-200"
                  }`}
                >
                  {p}
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
                  {brief.step3.previewPackaging ?? "packaging"} preview
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
