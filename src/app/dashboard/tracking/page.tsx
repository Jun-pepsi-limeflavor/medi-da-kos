"use client";

import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { loadTracking } from "@/lib/firestore-service";
import type { TrackingEntry } from "@/lib/types";

const CARRIERS = ["FedEx", "DHL", "UPS", "Other"] as const;

export default function TrackingPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TrackingEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    loadTracking(user.uid).then(setEntries);
  }, [user]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">Shipment tracking</h1>
      <p className="mt-1 text-sm text-slate-500">
        Track sample and bulk shipments from Korean ODM partners.
      </p>

      {entries.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20">
          <Truck className="h-12 w-12 text-slate-300" />
          <p className="mt-4 font-medium text-slate-600">No tracking entries</p>
          <p className="mt-2 text-sm text-slate-400">
            Tracking numbers will appear here after your first shipment.
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-slate-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">Carrier</th>
                <th className="px-4 py-3 font-medium text-slate-600">Tracking #</th>
                <th className="px-4 py-3 font-medium text-slate-600">Description</th>
                <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-50">
                  <td className="px-4 py-3">{e.carrier}</td>
                  <td className="px-4 py-3 font-mono text-xs">{e.trackingNumber}</td>
                  <td className="px-4 py-3">{e.description}</td>
                  <td className="px-4 py-3 capitalize">{e.status.replace("-", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-slate-400">
        Supported carriers: {CARRIERS.join(", ")}
      </p>
    </div>
  );
}
