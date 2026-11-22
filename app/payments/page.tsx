"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatDateTime,
  money,
  request,
  useDebounced,
  useManagerToken,
} from "../../lib/manager-api";

type BalanceRow = {
  id: string;
  supplier_code: string;
  full_name: string;
  phone?: string | null;
  is_active?: boolean | null;
  earned: number;
  deducted: number;
  paid: number;
  balance: number;
  last_paid_at: string | null;
  payment_in_progress: boolean;
};
type Meta = { total: number; page: number; pageSize: number; totalPages: number };
type Totals = { totalOwed: number; suppliersOwed: number; inProgress: number };

const PAGE_SIZE = 20;
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a6b48]";
const field =
  "w-full rounded-xl border border-[#dce6dd] bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-[#9aa89f] focus:border-[#5a9960] focus:ring-2 focus:ring-[#5a9960]/20";

function BalanceCell({ value }: { value: number }) {
  if (value < 0)
    return (
      <span className="font-bold text-red-700" title="The supplier owes SuperLeo this amount">
        −{money(Math.abs(value))}
      </span>
    );
  return (
    <span className={`font-bold ${value >= 1 ? "text-[#0a6b48]" : "text-[#809087]"}`}>
      {money(value)}
    </span>
  );
}

export default function PaymentsOverviewPage() {
  const router = useRouter();
  const token = useManagerToken();

  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 300);
  const [owedOnly, setOwedOnly] = useState(true);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 });
  const [totals, setTotals] = useState<Totals>({ totalOwed: 0, suppliersOwed: 0, inProgress: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (token === null) router.replace("/");
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    const id = ++latest.current;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      search,
      owedOnly: owedOnly ? "1" : "0",
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    request<{ data: BalanceRow[]; meta: Meta; totals: Totals }>(
      `/payments/balances?${params}`,
      token,
    )
      .then((response) => {
        if (id !== latest.current) return;
        setRows(response.data);
        setMeta(response.meta);
        setTotals(response.totals);
        if (response.meta.page > response.meta.totalPages) setPage(response.meta.totalPages);
      })
      .catch((e) => {
        if (id !== latest.current) return;
        setError(e instanceof Error ? e.message : "Could not load payments");
      })
      .finally(() => {
        if (id === latest.current) setLoading(false);
      });
  }, [token, search, owedOnly, page, reloadKey]);

  if (token === undefined || token === null)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f7f2] px-4 text-sm font-semibold text-[#17372d]">
        Checking access...
      </main>
    );

  const first = meta.total ? (meta.page - 1) * meta.pageSize + 1 : 0;
  const last = Math.min(meta.total, meta.page * meta.pageSize);

  return (
    <main className="min-h-screen bg-[#f4f7f2] text-[#17372d]">

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 md:px-12">
        <p className="text-xs font-bold uppercase tracking-[.15em] text-[#5a9960]">Payments</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Pay suppliers</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71847a] sm:text-base">
          What each supplier is owed for their milk, after feed and other deductions. Open a
          supplier to pay them by M-Pesa.
        </p>

        <dl className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
          <div className="min-w-0 rounded-2xl bg-[#17372d] p-4 text-white sm:p-5">
            <dt className="truncate text-xs text-[#b7cabd]">Owed to suppliers</dt>
            <dd className="mt-1 truncate text-lg font-bold sm:text-2xl">{money(totals.totalOwed)}</dd>
          </div>
          <div className="min-w-0 rounded-2xl border border-[#dce6dd] bg-white p-4 sm:p-5">
            <dt className="truncate text-xs text-[#809087]">Suppliers to pay</dt>
            <dd className="mt-1 text-lg font-bold sm:text-2xl">{totals.suppliersOwed}</dd>
          </div>
          <div className="min-w-0 rounded-2xl border border-[#dce6dd] bg-white p-4 sm:p-5">
            <dt className="truncate text-xs text-[#809087]">In progress</dt>
            <dd className="mt-1 text-lg font-bold sm:text-2xl">{totals.inProgress}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#dce6dd] bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <label className="relative block flex-1 sm:max-w-md">
            <span className="sr-only">Search suppliers</span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, supplier code or phone"
              className={field}
            />
          </label>
          <div
            role="group"
            aria-label="Filter"
            className="inline-flex self-start rounded-xl bg-[#eef5e8] p-1"
          >
            {[
              { id: true, label: "Owed only" },
              { id: false, label: "All suppliers" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={owedOnly === option.id}
                onClick={() => {
                  setOwedOnly(option.id);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition sm:text-sm ${
                  owedOnly === option.id
                    ? "bg-white text-[#0a6b48] shadow-sm"
                    : "text-[#64766b] hover:text-[#0a6b48]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-semibold text-red-700"
          >
            <span className="min-w-0 break-words">{error}</span>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 font-bold"
            >
              Try again
            </button>
          </div>
        )}

        <div className="mt-5 overflow-hidden rounded-2xl border border-[#dce6dd] bg-white">
          {/* Desktop table */}
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="bg-[#f4f7f2] text-xs uppercase tracking-wider text-[#71847a]">
              <tr>
                <th className="px-5 py-3 font-bold">Supplier</th>
                <th className="px-3 py-3 text-right font-bold">Earned</th>
                <th className="px-3 py-3 text-right font-bold">Deductions</th>
                <th className="px-3 py-3 text-right font-bold">Paid</th>
                <th className="px-3 py-3 text-right font-bold">Balance due</th>
                <th className="px-3 py-3 font-bold">Last paid</th>
                <th className="px-5 py-3 text-right font-bold">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[#edf2ed] transition hover:bg-[#f9fbf8]">
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/suppliers/${row.id}/payments`}
                      className={`block rounded-lg ${focusRing}`}
                    >
                      <span className="block font-bold">{row.full_name}</span>
                      <span className="block text-xs font-semibold text-[#5a9960]">
                        {row.supplier_code}
                        {row.is_active === false && (
                          <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                            Inactive
                          </span>
                        )}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3.5 text-right tabular-nums">{money(row.earned)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums text-[#9a7440]">
                    {row.deducted > 0 ? `−${money(row.deducted)}` : "—"}
                  </td>
                  <td className="px-3 py-3.5 text-right tabular-nums">{money(row.paid)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums">
                    <BalanceCell value={row.balance} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-xs text-[#71847a]">
                    {row.payment_in_progress ? (
                      <span className="rounded-full bg-[#fbe3b4] px-2.5 py-1 font-bold uppercase tracking-wider text-[#8a5a12]">
                        In progress
                      </span>
                    ) : row.last_paid_at ? (
                      formatDateTime(row.last_paid_at)
                    ) : (
                      "Never"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right">
                    <Link
                      href={`/suppliers/${row.id}/payments`}
                      className={`inline-block rounded-xl px-3.5 py-2 text-sm font-bold transition ${focusRing} ${
                        row.balance >= 1
                          ? "bg-[#0a6b48] text-white hover:bg-[#085a3d]"
                          : "border border-[#c8d8cb] hover:border-[#5a9960]"
                      }`}
                    >
                      {row.balance >= 1 ? "Pay" : "View"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <ul className={`divide-y divide-[#edf2ed] md:hidden ${loading ? "opacity-60" : ""}`}>
            {rows.map((row) => (
              <li key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{row.full_name}</p>
                    <p className="text-xs font-semibold text-[#5a9960]">{row.supplier_code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#809087]">Balance due</p>
                    <BalanceCell value={row.balance} />
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-[#809087]">Earned</dt>
                    <dd className="font-semibold">{money(row.earned)}</dd>
                  </div>
                  <div>
                    <dt className="text-[#809087]">Deductions</dt>
                    <dd className="font-semibold">{row.deducted > 0 ? `−${money(row.deducted)}` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[#809087]">Paid</dt>
                    <dd className="font-semibold">{money(row.paid)}</dd>
                  </div>
                </dl>
                <Link
                  href={`/suppliers/${row.id}/payments`}
                  className={`mt-3 block rounded-xl py-2 text-center text-sm font-bold ${focusRing} ${
                    row.balance >= 1
                      ? "bg-[#0a6b48] text-white"
                      : "border border-[#c8d8cb]"
                  }`}
                >
                  {row.payment_in_progress ? "Payment in progress" : row.balance >= 1 ? "Pay" : "View"}
                </Link>
              </li>
            ))}
          </ul>

          {loading && !rows.length && (
            <div aria-hidden className="divide-y divide-[#edf2ed]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 p-4 md:px-5">
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 rounded bg-[#eef2ec]" />
                    <div className="h-3 w-24 rounded bg-[#f3f6f1]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && !rows.length && (
            <div className="px-4 py-14 text-center">
              <p className="font-bold">
                {owedOnly ? "No suppliers are owed anything" : "No suppliers found"}
              </p>
              <p className="mt-1 text-sm text-[#71847a]">
                {owedOnly
                  ? "Switch to All suppliers to see every balance."
                  : "Nothing matches your search."}
              </p>
            </div>
          )}
        </div>

        {meta.total > 0 && (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-[#71847a]">
              Showing <strong className="text-[#17372d]">{first}–{last}</strong> of{" "}
              <strong className="text-[#17372d]">{meta.total}</strong>
            </p>
            {meta.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={meta.page <= 1}
                  onClick={() => setPage(meta.page - 1)}
                  className={`rounded-lg border border-[#c8d8cb] bg-white px-3 py-2 text-sm font-bold transition hover:border-[#5a9960] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
                >
                  Previous
                </button>
                <span className="px-1 text-sm font-semibold">
                  {meta.page} / {meta.totalPages}
                </span>
                <button
                  type="button"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setPage(meta.page + 1)}
                  className={`rounded-lg border border-[#c8d8cb] bg-white px-3 py-2 text-sm font-bold transition hover:border-[#5a9960] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
