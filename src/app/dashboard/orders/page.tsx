"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { loadOrders } from "@/lib/firestore-service";
import type { Order } from "@/lib/types";

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadOrders(user.uid)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">My Orders</h1>
      <p className="mt-1 text-sm text-slate-500">
        Custom briefs and sample requests appear here after submission.
      </p>

      {loading ? (
        <p className="mt-12 text-slate-500">Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20">
          <Package className="h-12 w-12 text-slate-300" />
          <p className="mt-4 font-medium text-slate-600">No orders yet</p>
          <p className="mt-2 max-w-sm text-center text-sm text-slate-400">
            Submit your CM brief (Step 6) or request a Top 10 sample from the
            dashboard.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Go to CM Brief
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {orders.map((order) => (
            <article
              key={order.id}
              className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      order.type === "sample"
                        ? "bg-violet-50 text-violet-700"
                        : "bg-sky-50 text-sky-700"
                    }`}
                  >
                    {order.type === "sample" ? "Sample" : "Custom"}
                  </span>
                  <h2 className="mt-2 font-semibold text-slate-800">
                    {order.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">{order.summary}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium capitalize text-slate-700">
                    {order.status.replace("-", " ")}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(order.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
