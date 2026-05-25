"use client";

/**
 * RnD Agency intake — replace with your survey fields when ready.
 * Answers are stored on brief.step1.rndSurvey in Firestore.
 */
interface Props {
  value?: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function RndAgencySurveyPlaceholder({ value, onChange }: Props) {
  const notes =
    typeof value?.notes === "string" ? value.notes : "";

  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-6 lg:p-8">
      <h3 className="text-xl font-semibold text-slate-800">RnD Agency intake</h3>
      <p className="mt-2 text-base text-slate-600">
        Your custom survey will be connected here. For now, you can save draft
        notes below — we will map this to the full questionnaire you provide
        later.
      </p>
      <div className="mt-6">
        <label className="mb-2 block text-sm font-medium text-slate-600">
          Project notes (temporary)
        </label>
        <textarea
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          rows={5}
          placeholder="Describe your RnD goals, timeline, and requirements…"
          value={notes}
          onChange={(e) =>
            onChange({ ...value, notes: e.target.value, _placeholder: true })
          }
        />
      </div>
      <p className="mt-4 text-sm text-violet-700/80">
        CM Steps 2–6 apply to Skin Care / Cosmetic ODM paths. RnD workflow steps
        will be added when your survey spec is ready.
      </p>
    </div>
  );
}
