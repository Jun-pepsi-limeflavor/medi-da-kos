"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CMBrief,
  FragranceOption,
  PackagingSelection,
  ProductCategory,
  Step1Selection,
} from "@/lib/types";
import { isOdmSelection, odmCategory } from "@/lib/step1-utils";
import { RndAgencySurveyPlaceholder } from "./RndAgencySurveyPlaceholder";
import { LogoPackagingPreview } from "./LogoPackagingPreview";
import {
  LOGO_UPLOAD_RULES,
  validateAndReadLogoFile,
} from "@/lib/logo-upload";
import {
  minSampleRequestDate,
  minTargetLaunchDate,
} from "@/lib/us-date";
import {
  getPackagingGroupImage,
  getPackagingGroups,
  getPackagingItems,
} from "@/lib/packaging-options";
import { PackagingGroupButton } from "./PackagingGroupButton";
import { submitCustomBrief } from "@/lib/firestore-service";
import { useDashboardBrief } from "@/lib/dashboard-brief-context";
import { REDIRECT_AFTER_BRIEF_SUBMIT } from "@/lib/routes";
import { Top10Products } from "./Top10Products";

const stepContentClass = "min-h-[min(58vh,520px)] py-2";
const step1ContentClass = "flex min-h-0 flex-1 flex-col py-2";
const stepTitleClass = "text-2xl font-semibold text-slate-800";
const stepDescClass = "mt-2 text-base text-slate-500";
const choiceChipClass =
  "rounded-xl border-2 px-5 py-3.5 text-sm font-medium transition md:text-base";
const inputClass =
  "w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

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
      setTimeout(() => router.push(REDIRECT_AFTER_BRIEF_SUBMIT), 1500);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !brief) {
    return <p className="text-slate-500">Loading your custom brief…</p>;
  }

  const step = brief.currentStep;

  return (
    <div
      className={
        step === 1
          ? "flex min-h-[calc(100vh-5rem)] flex-col"
          : "flex min-h-[calc(100vh-5rem)] flex-col"
      }
    >
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

      <div
        className={`flex flex-1 flex-col rounded-2xl border border-slate-100 bg-white shadow-sm ${
          step === 1 ? "min-h-0" : ""
        }`}
      >
        <div className="flex flex-1 flex-col p-6 lg:p-10">
        {step === 1 && (
          <Step1
            step1={brief.step1}
            onSelect={(selection) => {
              const step1: NonNullable<CMBrief["step1"]> = { selection };
              if (
                selection === "rnd-agency" &&
                brief.step1?.rndSurvey
              ) {
                step1.rndSurvey = brief.step1.rndSurvey;
              }
              setBrief({
                ...brief,
                step1,
                step2: isOdmSelection(selection)
                  ? { selections: [] }
                  : brief.step2,
              });
            }}
            onRndSurveyChange={(rndSurvey) =>
              setBrief({
                ...brief,
                step1: {
                  selection: "rnd-agency",
                  rndSurvey,
                },
              })
            }
          />
        )}
        {step === 2 && (
          <Step2
            category={odmCategory(brief.step1)}
            selections={brief.step2?.selections ?? []}
            onChange={(selections) =>
              setBrief({ ...brief, step2: { selections } })
            }
          />
        )}
        {step === 3 && (
          <Step3
            category={odmCategory(brief.step1)}
            logoDataUrl={brief.step3?.logoDataUrl}
            onLogo={(logoDataUrl, logoFileName) =>
              setBrief({
                ...brief,
                step3: { ...brief.step3, logoDataUrl, logoFileName },
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

        <div className="mt-auto flex flex-wrap gap-3 border-t border-slate-100 pt-8">
          {step > 1 && (
            <button
              type="button"
              onClick={() => persist({ ...brief, currentStep: step - 1 }, false)}
              className="rounded-xl border border-slate-200 px-6 py-3 text-base font-medium text-slate-600 hover:bg-slate-50"
            >
              Back
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => persist(brief, false)}
            className="rounded-xl border border-sky-200 px-6 py-3 text-base font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-60"
          >
            Save draft
          </button>
          {step < 6 ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => persist(brief, true)}
              className="rounded-xl bg-sky-600 px-6 py-3 text-base font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              Save & continue
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || brief.status === "submitted"}
              onClick={handleSubmit}
              className="rounded-xl bg-slate-900 px-6 py-3 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {brief.status === "submitted" ? "Already submitted" : "Submit brief"}
            </button>
          )}
        </div>
        </div>
      </div>

      {step === 1 && <Top10Products uid={uid} compact />}
    </div>
  );
}

const STEP1_OPTIONS: {
  id: Step1Selection;
  label: string;
  desc: string;
  image: string;
}[] = [
  {
    id: "skincare",
    label: "Skin Care",
    desc: "Serums, creams, toners, cleansers, and treatments.",
    image: "/step1_skincare.png",
  },
  {
    id: "cosmetic",
    label: "Cosmetic",
    desc: "Color cosmetics, makeup, and decorative products.",
    image: "/step1_cosmetic.png",
  },
  {
    id: "rnd-agency",
    label: "RnD Agency",
    desc: "Partner with our R&D team for formulation and development services.",
    image: "/step1_RnD.png",
  },
];

function CategoryChoiceCard({
  label,
  desc,
  image,
  selected,
  onClick,
}: {
  label: string;
  desc: string;
  image: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-full min-h-[min(42vh,400px)] flex-col overflow-hidden rounded-2xl border-2 text-left transition ${
        selected
          ? "border-sky-500 bg-sky-50/80 shadow-md ring-2 ring-sky-200"
          : "border-slate-100 bg-white hover:border-sky-200 hover:shadow-sm"
      }`}
    >
      <div className="relative min-h-[min(32vh,280px)] flex-1 w-full overflow-hidden bg-gradient-to-b from-sky-50/80 to-white">
        <Image
          src={image}
          alt={label}
          fill
          className="object-cover object-center transition duration-500 group-hover:scale-[1.03]"
          sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 33vw"
          priority
        />
        <div
          className={`absolute inset-0 transition ${
            selected
              ? "bg-sky-600/15"
              : "bg-transparent group-hover:bg-slate-900/5"
          }`}
          aria-hidden
        />
      </div>
      <div className="shrink-0 border-t border-slate-100/80 bg-white px-6 py-5">
        <p className="text-xl font-semibold text-slate-800">{label}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{desc}</p>
      </div>
    </button>
  );
}

function Step1({
  step1,
  onSelect,
  onRndSurveyChange,
}: {
  step1?: CMBrief["step1"];
  onSelect: (selection: Step1Selection) => void;
  onRndSurveyChange: (data: Record<string, unknown>) => void;
}) {
  const selection = step1?.selection ?? step1?.category;
  const showRndSurvey = selection === "rnd-agency";

  return (
    <div className={step1ContentClass}>
      <div className="shrink-0">
        <h2 className={stepTitleClass}>Select product category</h2>
        <p className={stepDescClass}>
          Choose your pathway — ODM manufacturing or RnD Agency services.
        </p>
      </div>

      <div className="mt-6 grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3 2xl:gap-6">
        {STEP1_OPTIONS.map((opt) => (
          <CategoryChoiceCard
            key={opt.id}
            label={opt.label}
            desc={opt.desc}
            image={opt.image}
            selected={selection === opt.id}
            onClick={() => onSelect(opt.id)}
          />
        ))}
      </div>

      {showRndSurvey && (
        <div className="mt-6 shrink-0">
          <RndAgencySurveyPlaceholder
            value={step1?.rndSurvey}
            onChange={onRndSurveyChange}
          />
        </div>
      )}
    </div>
  );
}

function Step2({
  category,
  selections,
  onChange,
}: {
  category?: ProductCategory;
  selections: PackagingSelection[];
  onChange: (s: PackagingSelection[]) => void;
}) {
  if (!category) {
    return (
      <div className={stepContentClass}>
        <h2 className={stepTitleClass}>Packaging options</h2>
        <p className={stepDescClass}>
          Packaging selection applies to Skin Care and Cosmetic ODM paths. Complete
          your RnD Agency survey in Step 1, or switch to an ODM category to
          continue here.
        </p>
      </div>
    );
  }

  const groups = getPackagingGroups(category);
  const activeSelection = selections[0];
  const activeGroup = activeSelection?.group;

  useEffect(() => {
    if (selections.length > 1) {
      onChange([selections[selections.length - 1]!]);
    }
  }, [selections, onChange]);

  function isGroupSelected(group: string) {
    return activeGroup === group;
  }

  /** Single mid-category only — new pick replaces the previous one. */
  function selectGroup(group: string) {
    if (activeGroup === group) {
      onChange([]);
      return;
    }
    onChange([{ group, items: [] }]);
  }

  function toggleItem(group: string, item: string) {
    const existing =
      activeSelection?.group === group ? activeSelection : undefined;
    if (!existing) {
      onChange([{ group, items: [item] }]);
      return;
    }
    const has = existing.items.includes(item);
    const newItems = has
      ? existing.items.filter((i) => i !== item)
      : [...existing.items, item];
    onChange([{ group, items: newItems }]);
  }

  function isItemSelected(group: string, item: string) {
    return selections.some(
      (s) => s.group === group && s.items.includes(item),
    );
  }

  return (
    <div className={stepContentClass}>
      <h2 className={stepTitleClass}>Packaging options</h2>
      <p className={stepDescClass}>
        Choose one packaging category for your{" "}
        {category === "skincare" ? "Skin Care" : "Cosmetic"} line. Formats and
        types below are optional.
      </p>

      <div className="mt-8">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-400">
          Category
        </p>
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4"
          role="list"
        >
          {groups.map((group) => (
            <li key={group} className="min-w-0">
              <PackagingGroupButton
                label={group}
                imageSrc={getPackagingGroupImage(group)}
                selected={isGroupSelected(group)}
                onClick={() => selectGroup(group)}
              />
            </li>
          ))}
        </ul>

        {activeGroup && (
          <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50/40 p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Optional formats & types
            </p>
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-slate-700">
                {activeGroup}
                <span className="ml-2 text-sm font-normal text-slate-400">
                  optional
                </span>
              </h3>
              <div className="mt-4 flex flex-wrap gap-3">
                {getPackagingItems(category, activeGroup).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleItem(activeGroup, item)}
                    className={`${choiceChipClass} ${
                      isItemSelected(activeGroup, item)
                        ? "border-sky-500 bg-sky-50 text-sky-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-sky-200"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Step3({
  category,
  logoDataUrl,
  onLogo,
}: {
  category?: ProductCategory;
  logoDataUrl?: string;
  onLogo: (dataUrl: string, fileName: string) => void;
}) {
  const [uploadError, setUploadError] = useState("");

  async function handleLogoFile(file: File | undefined) {
    if (!file) return;
    setUploadError("");
    const result = await validateAndReadLogoFile(file);
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    onLogo(result.dataUrl, file.name);
  }

  if (!category) {
    return (
      <div className={stepContentClass}>
        <h2 className={stepTitleClass}>Logo & packaging preview</h2>
        <p className={stepDescClass}>
          Select Skin Care or Cosmetic in Step 1 to preview your logo on packaging.
        </p>
      </div>
    );
  }

  return (
    <div className={stepContentClass}>
      <h2 className={stepTitleClass}>Logo & packaging preview</h2>
      <p className={stepDescClass}>
        Upload your logo as PNG (transparent background recommended). Preview on
        the {category === "skincare" ? "Skin Care" : "Cosmetic"} tube mockup.
      </p>
      <div className="mt-8 grid flex-1 gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <label className="mb-3 block text-base font-medium text-slate-700">
            Upload logo
          </label>
          <input
            type="file"
            accept={LOGO_UPLOAD_RULES.acceptMime}
            className="text-base"
            onChange={(e) => {
              void handleLogoFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <p className="mt-2 text-sm text-slate-500">
            Allowed: PNG, JPG, WebP, SVG · Min {LOGO_UPLOAD_RULES.minWidth}×
            {LOGO_UPLOAD_RULES.minHeight}px · Max 5MB
          </p>
          {uploadError && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {uploadError}
            </p>
          )}
          {logoDataUrl && (
            <img
              src={logoDataUrl}
              alt="Logo thumbnail"
              className="mt-4 max-h-20 rounded-lg border border-slate-100 bg-white object-contain p-2"
            />
          )}
        </div>
        <div>
          <label className="mb-3 block text-base font-medium text-slate-700">
            Packaging preview
          </label>
          <LogoPackagingPreview category={category} logoDataUrl={logoDataUrl} />
        </div>
      </div>
    </div>
  );
}

function normalizeHexInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "#7dd3fc";
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (/^#[0-9A-Fa-f]{6}$/.test(withHash)) return withHash;
  if (/^#[0-9A-Fa-f]{3}$/.test(withHash)) {
    const h = withHash.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  return raw;
}

function Step4({
  value,
  onChange,
}: {
  value?: CMBrief["step4"];
  onChange: (v: NonNullable<CMBrief["step4"]>) => void;
}) {
  const minSample = minSampleRequestDate();
  const minLaunch = minTargetLaunchDate();

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
    <div className={stepContentClass}>
      <h2 className={stepTitleClass}>Volume, MOQ & timeline</h2>
      <p className={stepDescClass}>
        Dates use US Eastern time. Sample requests from 2 weeks out; launch from
        6 weeks out.
      </p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:gap-8">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">Volume</label>
          <input className={inputClass} value={v.volume} onChange={(e) => set({ volume: e.target.value })} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">Unit</label>
          <select className={inputClass} value={v.unit} onChange={(e) => set({ unit: e.target.value as "ml" | "g" | "oz" })}>
            <option value="ml">ml</option>
            <option value="g">g</option>
            <option value="oz">oz</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">MOQ</label>
          <input className={inputClass} value={v.moq} onChange={(e) => set({ moq: e.target.value })} placeholder="e.g. 3,000 units" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">
            Sample request date
          </label>
          <input
            type="date"
            className={inputClass}
            min={minSample}
            value={v.sampleRequestDate}
            onChange={(e) => {
              const d = e.target.value;
              set({
                sampleRequestDate: d && d < minSample ? minSample : d,
              });
            }}
          />
          <p className="mt-1 text-xs text-slate-400">
            Earliest: {minSample} (US Eastern, 2 weeks from today)
          </p>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">
            Target launch date
          </label>
          <input
            type="date"
            className={inputClass}
            min={minLaunch}
            value={v.targetLaunchDate}
            onChange={(e) => {
              const d = e.target.value;
              set({
                targetLaunchDate: d && d < minLaunch ? minLaunch : d,
              });
            }}
          />
          <p className="mt-1 text-xs text-slate-400">
            Earliest: {minLaunch} (US Eastern, 6 weeks from today)
          </p>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">Shipping country</label>
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
    <div className={stepContentClass}>
      <h2 className={stepTitleClass}>Formula preferences</h2>
      <div className="mt-8 max-w-2xl space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">Fragrance</label>
          <select className={inputClass} value={v.fragrance} onChange={(e) => set({ fragrance: e.target.value as FragranceOption })}>
            <option value="green-tea">Green tea</option>
            <option value="hypoallergenic">Hypoallergenic</option>
            <option value="unscented">Unscented</option>
            <option value="fragrance-free">Fragrance-free</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">
            Color
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="color"
              className="h-12 w-24 shrink-0 cursor-pointer rounded-lg border border-slate-200"
              value={v.colorHex}
              onChange={(e) => set({ colorHex: e.target.value })}
              aria-label="Color picker"
            />
            <input
              type="text"
              className={`${inputClass} max-w-[10rem] font-mono`}
              placeholder="#7DD3FC"
              value={v.colorHex}
              onChange={(e) => set({ colorHex: normalizeHexInput(e.target.value) })}
              spellCheck={false}
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Use the swatch or enter a hex code (e.g. #FF5733).
          </p>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">Viscosity</label>
          <input className={inputClass} value={v.viscosity} onChange={(e) => set({ viscosity: e.target.value })} placeholder="e.g. light gel" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">Texture (optional)</label>
          <input className={inputClass} value={v.textureNotes ?? ""} onChange={(e) => set({ textureNotes: e.target.value })} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">Finish (optional)</label>
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
    productName: "",
    vegan: false,
    functionalClaims: [] as string[],
    conceptIngredients: "",
    restrictedIngredients: "",
    internationalCertifications: [] as string[],
  };
  const set = (patch: Partial<typeof v>) => onChange({ ...v, ...patch });
  const certs = ["FDA", "EU CPNP", "Halal", "Vegan Society", "ISO 22716"];

  return (
    <div className={stepContentClass}>
      <h2 className={stepTitleClass}>Compliance & certifications</h2>
      <div className="mt-8 max-w-3xl space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">
            Product name
          </label>
          <input
            className={inputClass}
            value={v.productName ?? ""}
            onChange={(e) => set({ productName: e.target.value })}
            placeholder="e.g. xx Eye Cream"
          />
        </div>
        <label className="flex items-center gap-3 text-base">
          <input type="checkbox" checked={v.vegan} onChange={(e) => set({ vegan: e.target.checked })} />
          Vegan formulation required
        </label>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">Concept / hero ingredients</label>
          <textarea className={inputClass} rows={4} value={v.conceptIngredients} onChange={(e) => set({ conceptIngredients: e.target.value })} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">Restricted ingredients</label>
          <textarea className={inputClass} rows={3} value={v.restrictedIngredients} onChange={(e) => set({ restrictedIngredients: e.target.value })} />
        </div>
        <div>
          <p className="mb-3 text-sm font-medium text-slate-600">International certifications</p>
          <div className="flex flex-wrap gap-3">
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
                className={`${choiceChipClass} rounded-full ${
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
