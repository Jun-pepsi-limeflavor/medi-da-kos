"use client";

import { Package } from "lucide-react";

export default function OrdersPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">My Orders</h1>
      <p className="mt-1 text-sm text-slate-500">
        Custom and sample orders will appear here once submitted.
      </p>

      <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20">
        <Package className="h-12 w-12 text-slate-300" />
        <p className="mt-4 font-medium text-slate-600">No orders yet</p>
        <p className="mt-2 max-w-sm text-center text-sm text-slate-400">
          Complete your CM brief or submit a sample request from the dashboard
          to see orders here.
        </p>
      </div>
    </div>
  );
}
