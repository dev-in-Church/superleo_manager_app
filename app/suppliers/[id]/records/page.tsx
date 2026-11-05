"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ManagerHeader } from "../../../../components/manager-header";
import {
  formatDate,
  litres,
  request,
  useManagerToken,
  type Delivery,
  type SupplierRow,
} from "../../../../lib/manager-api";

type Session = "all" | "morning" | "evening";
const PAGE_SIZE = 20;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a6b48]";
const eyebrow = "text-xs font-bold uppercase tracking-[.15em] text-[#5a9960]";

export default function SupplierRecordsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const token = useManagerToken();

  const [supplier, setSupplier] = useState<SupplierRow | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [session, setSession] = useState<Session>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (token === null) router.replace("/");
  }, [token, router]);

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    Promise.all([
      request<{ data: SupplierRow }>(`/admin/suppliers/${id}`, token),
      request<{ data: Delivery[] }>(`/deliveries?supplierId=${id}`, token),
    ])
      .then(([s, d]) => {
        setSupplier(s.data);
        setDeliveries(d.data);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load records"),
      )
      .finally(() => setLoading(false));
  }, [token, id]);

  const notify = (text: string, error = false) => setNotice({ text, error });

  // Newest first, then filtered and paged here in the browser
  const sorted = useMemo(
    () =>
      [...deliveries].sort((a, b) =>
        String(b.session_date).localeCompare(String(a.session_date)),
      ),
    [deliveries],
  );
  const filtered = useMemo(
    () =>
      sorted.filter(
        (d) =>
          session === "all" || String(d.session_type).toLowerCase() === session,
      ),
    [sorted, session],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const totalLitres = deliveries.reduce(
    (sum, d) => sum + Number(d.quantity_litres),
    0,
  );
  const first = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(filtered.length, currentPage * PAGE_SIZE);

  async function editDelivery(delivery: Delivery) {
    if (!token) return;
    const quantity = prompt(
      "Quantity in litres",
      String(delivery.quantity_litres),
    );
    if (quantity === null || quantity.trim() === "") return;
    const value = Number(quantity);
    if (!Number.isFinite(value) || value <= 0) {
      notify("Enter a quantity greater than 0.", true);
      return;
    }
    try {
      await request(`/deliveries/${delivery.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ quantityLitres: value }),
      });
      setDeliveries((items) =>
        items.map((item) =>
          item.id === delivery.id ? { ...item, quantity_litres: value } : item,
        ),
      );
      notify("Milk record updated.");
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Could not update the record",
        true,
      );
    }
  }

  async function deleteDelivery(delivery: Delivery) {
    if (!token || !confirm("Delete this milk record permanently?")) return;
    try {
      await request(`/deliveries/${delivery.id}`, token, { method: "DELETE" });
      setDeliveries((items) => items.filter((item) => item.id !== delivery.id));
      notify("Milk record deleted.");
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Could not delete the record",
        true,
      );
    }
  }

  if (token === undefined || token === null || loading)
    return (
      <main className="min-h-screen bg-[#f4f7f2] text-[#17372d]">
        <ManagerHeader active="suppliers" />
        <div className="grid place-items-center px-4 py-32 text-sm font-semibold">
          <span className="flex items-center gap-3">
            <span
              aria-hidden
              className="size-5 animate-spin rounded-full border-2 border-[#b7d3b6] border-t-[#0a6b48]"
            />
            Loading records...
          </span>
        </div>
      </main>
    );

  if (error || !supplier)
    return (
      <main className="min-h-screen bg-[#f4f7f2] text-[#17372d]">
        <ManagerHeader active="suppliers" />
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-xl font-bold">{error || "Supplier not found"}</h1>
          <Link
            href="/suppliers"
            className="mt-5 inline-block rounded-xl bg-[#0a6b48] px-5 py-3 text-sm font-bold text-white"
          >
            Back to suppliers
          </Link>
        </div>
      </main>
    );

  return (
    <main className="min-h-screen bg-[#f4f7f2] text-[#17372d]">
      <ManagerHeader active="suppliers" />

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 md:px-12">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-[#0a6b48]"
        >
          <Link
            href="/suppliers"
            className={`rounded-lg hover:underline ${focusRing}`}
          >
            All suppliers
          </Link>
          <span aria-hidden className="text-[#9aa89f]">
            /
          </span>
          <Link
            href={`/suppliers/${supplier.id}`}
            className={`rounded-lg hover:underline ${focusRing}`}
          >
            {supplier.full_name}
          </Link>
        </nav>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className={eyebrow}>Milk records</p>
            <h1 className="mt-2 truncate text-2xl font-bold tracking-tight sm:text-3xl">
              {supplier.full_name}
            </h1>
            <p className="mt-1 text-sm font-semibold text-[#5a9960]">
              {supplier.supplier_code}
            </p>
          </div>
          <Link
            href={`/suppliers/${supplier.id}`}
            className={`rounded-xl border border-[#c8d8cb] bg-white px-4 py-2.5 text-sm font-bold transition hover:border-[#5a9960] ${focusRing}`}
          >
            View profile
          </Link>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3 sm:gap-4">
          <div className="min-w-0 rounded-2xl border border-[#dce6dd] bg-white p-3 sm:p-4">
            <dt className="truncate text-[11px] text-[#809087] sm:text-xs">
              Records
            </dt>
            <dd className="mt-1 truncate text-lg font-bold sm:text-2xl">
              {deliveries.length}
            </dd>
          </div>
          <div className="min-w-0 rounded-2xl border border-[#dce6dd] bg-white p-3 sm:p-4">
            <dt className="truncate text-[11px] text-[#809087] sm:text-xs">
              Total supplied
            </dt>
            <dd className="mt-1 truncate text-lg font-bold sm:text-2xl">
              {litres(totalLitres)}
            </dd>
          </div>
          <div className="min-w-0 rounded-2xl border border-[#dce6dd] bg-white p-3 sm:p-4">
            <dt className="truncate text-[11px] text-[#809087] sm:text-xs">
              Latest
            </dt>
            <dd className="mt-1 truncate text-lg font-bold sm:text-2xl">
              {sorted[0] ? formatDate(sorted[0].session_date) : "—"}
            </dd>
          </div>
        </dl>

        {notice && (
          <div
            role="status"
            className={`mt-4 rounded-2xl border px-4 py-3.5 text-sm font-semibold ${
              notice.error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-[#c8dfbd] bg-[#edf7e9] text-[#285b38]"
            }`}
          >
            {notice.text}
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-[#dce6dd] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
            <h2 className="text-lg font-bold">All records</h2>
            <div
              role="group"
              aria-label="Filter by session"
              className="inline-flex rounded-xl bg-[#eef5e8] p-1"
            >
              {(["all", "morning", "evening"] as Session[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={session === option}
                  onClick={() => {
                    setSession(option);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition sm:text-sm ${
                    session === option
                      ? "bg-white text-[#0a6b48] shadow-sm"
                      : "text-[#64766b] hover:text-[#0a6b48]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {visible.length ? (
            <div className="overflow-x-auto border-t border-[#edf2ed]">
              <table className="w-full min-w-[440px] text-left text-sm">
                <thead className="bg-[#f4f7f2] text-xs uppercase tracking-wider text-[#71847a]">
                  <tr>
                    <th className="px-4 py-3 font-bold sm:px-5">Date</th>
                    <th className="px-2 py-3 font-bold">Session</th>
                    <th className="px-2 py-3 font-bold">Quantity</th>
                    <th className="px-4 py-3 text-right font-bold sm:px-5">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((delivery) => (
                    <tr
                      key={delivery.id}
                      className="border-t border-[#edf2ed] transition hover:bg-[#f9fbf8]"
                    >
                      <td className="whitespace-nowrap px-4 py-3 sm:px-5">
                        {formatDate(delivery.session_date)}
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                            String(delivery.session_type).toLowerCase() ===
                            "evening"
                              ? "bg-[#f4eee2] text-[#9a7440]"
                              : "bg-[#eef6eb] text-[#3e7c48]"
                          }`}
                        >
                          {delivery.session_type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 font-bold">
                        {litres(delivery.quantity_litres)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right sm:px-5">
                        <button
                          type="button"
                          onClick={() => editDelivery(delivery)}
                          className={`mr-1 rounded-lg px-2 py-1 font-bold text-[#0a6b48] transition hover:bg-[#eef5e8] ${focusRing}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDelivery(delivery)}
                          className={`rounded-lg px-2 py-1 font-bold text-red-700 transition hover:bg-red-50 ${focusRing}`}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="border-t border-[#edf2ed] px-4 py-12 text-center text-sm text-[#71847a]">
              {deliveries.length
                ? "No records for this session."
                : "No delivery records yet."}
            </p>
          )}

          {filtered.length > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-[#edf2ed] p-4 sm:flex-row sm:px-5">
              <p className="text-sm text-[#71847a]">
                Showing{" "}
                <strong className="text-[#17372d]">
                  {first}–{last}
                </strong>{" "}
                of <strong className="text-[#17372d]">{filtered.length}</strong>
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                    className={`rounded-lg border border-[#c8d8cb] bg-white px-3 py-2 text-sm font-bold transition hover:border-[#5a9960] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
                  >
                    Previous
                  </button>
                  <span className="px-1 text-sm font-semibold">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage(currentPage + 1)}
                    className={`rounded-lg border border-[#c8d8cb] bg-white px-3 py-2 text-sm font-bold transition hover:border-[#5a9960] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
