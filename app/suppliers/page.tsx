"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ManagerHeader } from "../../components/manager-header";
import {
  isActive,
  litres,
  request,
  useDebounced,
  useManagerToken,
  type SupplierRow,
} from "../../lib/manager-api";

type Status = "all" | "active" | "inactive";
type Meta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const PAGE_SIZE = 20;
const SORTS = [
  { id: "name_asc", label: "Name (A–Z)" },
  { id: "records_desc", label: "Most records" },
  { id: "records_asc", label: "Fewest records" },
  { id: "newest", label: "Newest first" },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a6b48]";
const field =
  "w-full rounded-xl border border-[#dce6dd] bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-[#9aa89f] focus:border-[#5a9960] focus:ring-2 focus:ring-[#5a9960]/20";

function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = new Set([1, total, current - 1, current, current + 1]);
  const pages = [...wanted]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

function StatusBadge({ supplier }: { supplier: SupplierRow }) {
  const active = isActive(supplier);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
        active ? "bg-[#eef6eb] text-[#3e7c48]" : "bg-red-50 text-red-700"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#dceccd] text-sm font-bold uppercase text-[#0a6b48]"
    >
      {name.charAt(0)}
    </span>
  );
}

export default function SuppliersPage() {
  const router = useRouter();
  const token = useManagerToken();

  const [searchInput, setSearchInput] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const search = useDebounced(searchInput, 300);
  const address = useDebounced(addressInput, 300);
  const [status, setStatus] = useState<Status>("all");
  const [sort, setSort] = useState("name_asc");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [meta, setMeta] = useState<Meta>({
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1,
  });
  const [addresses, setAddresses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (token === null) router.replace("/");
  }, [token, router]);

  // Address suggestions (once)
  useEffect(() => {
    if (!token) return;
    request<{ data: string[] }>("/admin/suppliers/addresses", token)
      .then(({ data }) => setAddresses(data))
      .catch(() => {});
  }, [token]);

  // The list
  useEffect(() => {
    if (!token) return;
    const id = ++latest.current;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      search,
      address,
      status,
      sort,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    request<{ data: SupplierRow[]; meta: Meta }>(
      `/admin/suppliers/directory?${params}`,
      token,
    )
      .then((response) => {
        if (id !== latest.current) return; // a newer request replaced this one
        setRows(response.data);
        setMeta(response.meta);
        // The page no longer exists (for example after a delete elsewhere)
        if (response.meta.page > response.meta.totalPages)
          setPage(response.meta.totalPages);
      })
      .catch((e) => {
        if (id !== latest.current) return;
        setError(e instanceof Error ? e.message : "Could not load suppliers");
      })
      .finally(() => {
        if (id === latest.current) setLoading(false);
      });
  }, [token, search, address, status, sort, page, reloadKey]);

  const filtersActive = Boolean(
    searchInput || addressInput || status !== "all",
  );
  function clearFilters() {
    setSearchInput("");
    setAddressInput("");
    setStatus("all");
    setPage(1);
  }

  const first = meta.total ? (meta.page - 1) * meta.pageSize + 1 : 0;
  const last = Math.min(meta.total, meta.page * meta.pageSize);

  if (token === undefined || token === null)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f7f2] px-4 text-sm font-semibold text-[#17372d]">
        Checking access...
      </main>
    );

  return (
    <main className="min-h-screen bg-[#f4f7f2] text-[#17372d]">
      <ManagerHeader active="suppliers" />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 md:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[.15em] text-[#5a9960]">
              Directory
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              All suppliers
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71847a] sm:text-base">
              Search the directory, then open a supplier to see their profile or
              milk records.
            </p>
          </div>
          <div className="rounded-xl bg-[#dceccd] px-4 py-3 text-sm font-bold text-[#285b38]">
            {meta.total} {filtersActive ? "matching" : "suppliers"}
          </div>
        </div>

        {/* Search, filter, sort */}
        <div className="mt-6 rounded-2xl border border-[#dce6dd] bg-white p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_.8fr]">
            <label className="relative block">
              <span className="sr-only">Search suppliers</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#809087]"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, supplier code or phone"
                className={`${field} pl-10`}
              />
            </label>

            <label className="block">
              <span className="sr-only">Filter by address</span>
              <input
                list="address-options"
                value={addressInput}
                onChange={(e) => {
                  setAddressInput(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter by address"
                className={field}
              />
              <datalist id="address-options">
                {addresses.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>

            <label className="block">
              <span className="sr-only">Sort suppliers</span>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                className={field}
              >
                {SORTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    Sort: {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Filter by status"
              className="inline-flex rounded-xl bg-[#eef5e8] p-1"
            >
              {(["all", "active", "inactive"] as Status[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={status === option}
                  onClick={() => {
                    setStatus(option);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition sm:text-sm ${
                    status === option
                      ? "bg-white text-[#0a6b48] shadow-sm"
                      : "text-[#64766b] hover:text-[#0a6b48]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold text-[#0a6b48] transition hover:bg-[#eef5e8] ${focusRing}`}
              >
                Clear filters
              </button>
            )}
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

        {/* List */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-[#dce6dd] bg-white">
          {/* Desktop table */}
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="bg-[#f4f7f2] text-xs uppercase tracking-wider text-[#71847a]">
              <tr>
                <th className="px-5 py-3 font-bold">Supplier</th>
                <th className="px-3 py-3 font-bold">Contact</th>
                <th className="px-3 py-3 font-bold">Address</th>
                <th className="px-3 py-3 font-bold">Records</th>
                <th className="px-3 py-3 font-bold">Status</th>
                <th className="px-5 py-3 text-right font-bold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody
              className={
                loading ? "opacity-60 transition-opacity" : "transition-opacity"
              }
            >
              {rows.map((supplier) => (
                <tr
                  key={supplier.id}
                  className="border-t border-[#edf2ed] transition hover:bg-[#f9fbf8]"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/suppliers/${supplier.id}`}
                      className={`flex min-w-0 items-center gap-3 rounded-lg ${focusRing}`}
                    >
                      <Avatar name={supplier.full_name} />
                      <span className="min-w-0">
                        <span
                          className={`block truncate font-bold ${isActive(supplier) ? "" : "text-[#809087]"}`}
                        >
                          {supplier.full_name}
                        </span>
                        <span className="block text-xs font-semibold text-[#5a9960]">
                          {supplier.supplier_code}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3.5">
                    <p>
                      {supplier.phone || (
                        <span className="text-[#9aa89f]">No phone</span>
                      )}
                    </p>
                    <p
                      className="max-w-[200px] truncate text-xs text-[#71847a]"
                      title={supplier.email}
                    >
                      {supplier.email}
                    </p>
                  </td>
                  <td className="max-w-[180px] px-3 py-3.5">
                    <p className="truncate" title={supplier.address || ""}>
                      {supplier.address || (
                        <span className="text-[#9aa89f]">Not added</span>
                      )}
                    </p>
                  </td>
                  <td className="px-3 py-3.5">
                    <p className="font-bold">{supplier.records_count}</p>
                    <p className="text-xs text-[#71847a]">
                      {litres(supplier.total_litres)}
                    </p>
                  </td>
                  <td className="px-3 py-3.5">
                    <StatusBadge supplier={supplier} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right">
                    <Link
                      href={`/suppliers/${supplier.id}`}
                      className={`mr-2 inline-block rounded-xl border border-[#c8d8cb] px-3.5 py-2 text-sm font-bold transition hover:border-[#5a9960] ${focusRing}`}
                    >
                      Profile
                    </Link>
                    <Link
                      href={`/suppliers/${supplier.id}/records`}
                      className={`inline-block rounded-xl bg-[#0a6b48] px-3.5 py-2 text-sm font-bold text-white transition hover:bg-[#085a3d] ${focusRing}`}
                    >
                      Records
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <ul
            className={`divide-y divide-[#edf2ed] md:hidden ${loading ? "opacity-60 transition-opacity" : "transition-opacity"}`}
          >
            {rows.map((supplier) => (
              <li key={supplier.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/suppliers/${supplier.id}`}
                    className={`flex min-w-0 items-center gap-3 rounded-lg ${focusRing}`}
                  >
                    <Avatar name={supplier.full_name} />
                    <span className="min-w-0">
                      <span
                        className={`block truncate font-bold ${isActive(supplier) ? "" : "text-[#809087]"}`}
                      >
                        {supplier.full_name}
                      </span>
                      <span className="block text-xs font-semibold text-[#5a9960]">
                        {supplier.supplier_code}
                      </span>
                    </span>
                  </Link>
                  <StatusBadge supplier={supplier} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div className="min-w-0">
                    <dt className="text-xs text-[#809087]">Phone</dt>
                    <dd className="truncate">{supplier.phone || "—"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-[#809087]">Address</dt>
                    <dd className="truncate">{supplier.address || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#809087]">Records</dt>
                    <dd className="font-bold">
                      {supplier.records_count}{" "}
                      <span className="text-xs font-normal text-[#71847a]">
                        · {litres(supplier.total_litres)}
                      </span>
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/suppliers/${supplier.id}`}
                    className={`flex-1 rounded-xl border border-[#c8d8cb] py-2 text-center text-sm font-bold ${focusRing}`}
                  >
                    Profile
                  </Link>
                  <Link
                    href={`/suppliers/${supplier.id}/records`}
                    className={`flex-1 rounded-xl bg-[#0a6b48] py-2 text-center text-sm font-bold text-white ${focusRing}`}
                  >
                    Records
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          {/* First load */}
          {loading && !rows.length && (
            <div aria-hidden className="divide-y divide-[#edf2ed]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-center gap-3 p-4 md:px-5"
                >
                  <div className="size-10 rounded-full bg-[#eef2ec]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 rounded bg-[#eef2ec]" />
                    <div className="h-3 w-24 rounded bg-[#f3f6f1]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && !error && !rows.length && (
            <div className="px-4 py-14 text-center">
              <p className="font-bold">No suppliers found</p>
              <p className="mt-1 text-sm text-[#71847a]">
                {filtersActive
                  ? "Nothing matches your search or filters."
                  : "There are no suppliers yet."}
              </p>
              {filtersActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 rounded-xl border border-[#c8d8cb] px-4 py-2 text-sm font-bold text-[#0a6b48] hover:bg-[#f2f7f0]"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {meta.total > 0 && (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-[#71847a]">
              Showing{" "}
              <strong className="text-[#17372d]">
                {first}–{last}
              </strong>{" "}
              of <strong className="text-[#17372d]">{meta.total}</strong>
            </p>
            {meta.totalPages > 1 && (
              <nav aria-label="Pagination" className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={meta.page <= 1}
                  onClick={() => setPage(meta.page - 1)}
                  className={`rounded-lg border border-[#c8d8cb] bg-white px-3 py-2 text-sm font-bold transition hover:border-[#5a9960] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
                >
                  Previous
                </button>
                {pageList(meta.page, meta.totalPages).map((item, i) =>
                  item === "…" ? (
                    <span key={`gap-${i}`} className="px-1 text-[#809087]">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      aria-current={item === meta.page ? "page" : undefined}
                      onClick={() => setPage(item)}
                      className={`hidden min-w-9 rounded-lg px-2.5 py-2 text-sm font-bold transition sm:block ${focusRing} ${
                        item === meta.page
                          ? "bg-[#0a6b48] text-white"
                          : "text-[#17372d] hover:bg-[#eef5e8]"
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}
                <span className="px-2 text-sm font-semibold sm:hidden">
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
              </nav>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
