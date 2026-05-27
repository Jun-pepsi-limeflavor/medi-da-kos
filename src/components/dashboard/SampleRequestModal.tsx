"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { TopProduct, ShippingAddress } from "@/lib/types";
import { saveSampleRequest } from "@/lib/firestore-service";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

interface Props {
  product: TopProduct;
  uid: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function SampleRequestModal({
  product,
  uid,
  onClose,
  onSuccess,
}: Props) {
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [address, setAddress] = useState<ShippingAddress>({
    recipientName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    stateOrProvince: "",
    postalCode: "",
    country: "",
    phone: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await saveSampleRequest(uid, {
        sampleProductId: product.id,
        sampleProductName: product.nameEn,
        sampleQuantity: quantity,
        shippingAddress: address,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-900/20 p-4 backdrop-blur-[3px]">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-sky-100/80 bg-white/90 shadow-xl shadow-sky-100/40">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Request Sample
            </h2>
            <p className="mt-1 text-sm text-slate-500">{product.nameEn}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Sample quantity *
            </label>
            <input
              type="number"
              min={1}
              max={10}
              className={inputClass}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Shipping address
          </p>

          {(
            [
              ["recipientName", "Recipient name"],
              ["addressLine1", "Address line 1"],
              ["addressLine2", "Address line 2 (optional)"],
              ["city", "City"],
              ["stateOrProvince", "State / Province"],
              ["postalCode", "Postal code"],
              ["country", "Country"],
              ["phone", "Phone"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                {label}
                {key !== "addressLine2" ? " *" : ""}
              </label>
              <input
                className={inputClass}
                value={address[key]}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, [key]: e.target.value }))
                }
                required={key !== "addressLine2"}
              />
            </div>
          ))}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-sky-500/90 py-2.5 text-sm font-semibold text-white shadow-sm shadow-sky-100/70 transition hover:bg-sky-600 disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit sample request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
