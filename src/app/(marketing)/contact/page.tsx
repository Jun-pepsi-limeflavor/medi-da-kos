"use client";

import { useState } from "react";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div className="bg-gradient-to-b from-sky-50/80 to-white py-20">
      <div className="mx-auto max-w-xl px-4 sm:px-6">
        <h1 className="text-4xl font-semibold text-slate-800">Contact us</h1>
        <p className="mt-4 text-slate-600">
          Tell us about your brand and custom ODM goals. We typically respond
          within 1–2 business days.
        </p>
        <p className="mt-2 text-sm text-sky-700">
          <a href="mailto:contact@techasset.co.kr">contact@techasset.co.kr</a>
        </p>

        {sent ? (
          <div className="mt-8 rounded-xl bg-emerald-50 p-6 text-emerald-800">
            Thank you! Your message has been received. (Demo — not sent to server
            yet.)
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <input
              required
              placeholder="Name"
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm"
            />
            <input
              required
              type="email"
              placeholder="Email"
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm"
            />
            <input
              placeholder="Company"
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm"
            />
            <textarea
              required
              rows={5}
              placeholder="How can we help?"
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Send message
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
