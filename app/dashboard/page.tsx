"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "../../components/ui";
import { TOKEN_KEY, money, request } from "../../lib/manager-api";

type User = { full_name?: string; email: string; role: "manager" | "admin" };
type Supplier = {
  id: string;
  supplier_code: string;
  full_name: string;
  email: string;
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ---------- presentation helpers (no logic) ---------- */
const eyebrow = "text-xs font-bold uppercase tracking-[.15em] text-[#5a9960]";
const selectClass =
  "mt-2 w-full rounded-xl border border-[#dce6dd] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#5a9960] focus:ring-2 focus:ring-[#5a9960]/20";
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a6b48]";

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 shrink-0" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 10-1.4 1.4l2 2a1 1 0 001.4 0l4-4z"
      />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 shrink-0" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 6a1 1 0 112 0v4a1 1 0 11-2 0V6zm1 8a1 1 0 100-2 1 1 0 000 2z"
      />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [date, setDate] = useState(today());
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [quantity, setQuantity] = useState("");
  const [sessionType, setSessionType] = useState("morning");
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [pricePerLitre, setPricePerLitre] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [totalOwed, setTotalOwed] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return router.replace("/");
    request<{ data: User }>("/auth/me", token)
      .then(({ data }) => {
        if (!["manager", "admin"].includes(data.role))
          throw new Error("Forbidden");
        setUser(data);
        return request<{ data: Supplier[] }>("/admin/suppliers", token);
      })
      .then(({ data }) => setSuppliers(data))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        router.replace("/");
      })
      .finally(() => setLoading(false));
  }, [router]);

  // Default price, and what is currently owed to suppliers
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !user) return;
    request<{ data: { pricePerLitre: number } }>("/admin/settings/price", token)
      .then(({ data }) => {
        setPricePerLitre(data.pricePerLitre);
        setPriceInput(String(data.pricePerLitre));
      })
      .catch(() => {});
    request<{ totals: { totalOwed: number } }>(
      "/payments/balances?pageSize=1&owedOnly=1",
      token,
    )
      .then((response) => setTotalOwed(response.totals.totalOwed))
      .catch(() => {}); // payments not set up yet: the tile just shows a dash
  }, [user]);

  async function recordMilk(event: FormEvent) {
    event.preventDefault();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      await request("/deliveries", token, {
        method: "POST",
        body: JSON.stringify({
          supplierProfileId: selectedSupplier,
          quantityLitres: Number(quantity),
          sessionType,
          sessionDate: date,
        }),
      });
      const farmer = suppliers.find((item) => item.id === selectedSupplier);
      setNotice({
        type: "success",
        text: `Saved ${quantity} L for ${farmer?.full_name || "supplier"} · ${sessionType} collection on ${new Date(`${date}T00:00:00`).toLocaleDateString("en-GB")}.`,
      });
      setQuantity("");
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Could not save record",
      });
    }
  }

  async function savePrice(event: FormEvent) {
    event.preventDefault();
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const value = Number(priceInput);
    if (priceInput.trim() === "" || !Number.isFinite(value) || value < 0) {
      setNotice({ type: "error", text: "Enter a valid price per litre." });
      return;
    }
    setSavingPrice(true);
    try {
      const response = await request<{ data: { pricePerLitre: number } }>(
        "/admin/settings/price",
        token,
        { method: "PUT", body: JSON.stringify({ pricePerLitre: value }) },
      );
      setPricePerLitre(response.data.pricePerLitre);
      setPriceInput(String(response.data.pricePerLitre));
      setNotice({
        type: "success",
        text: `Default price set to KSh ${response.data.pricePerLitre.toFixed(2)} per litre. Suppliers with a custom price are not affected.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Could not save the price",
      });
    } finally {
      setSavingPrice(false);
    }
  }

  if (loading || !user)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f7f2] px-4 text-[#17372d]">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span
            aria-hidden
            className="size-5 animate-spin rounded-full border-2 border-[#b7d3b6] border-t-[#0a6b48]"
          />
          Checking access...
        </div>
      </main>
    );

  return (
    <main className="min-h-screen bg-[#f4f7f2] text-[#17372d]">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 md:px-12">
        {/* Page heading */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className={eyebrow}>{user.role} workspace</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Overview
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71847a] sm:text-base">
              Record collections and keep the default price up to date.
              Supplier reports and payments have their own pages.
            </p>
          </div>
          <Link
            href="/suppliers"
            className={`rounded-xl bg-[#dceccd] px-4 py-3 text-sm font-bold text-[#285b38] transition hover:bg-[#cfe3bd] ${focusRing}`}
          >
            Manage {suppliers.length} farmers
          </Link>
        </div>

        {/* Quick stats */}
        <dl className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
          <div className="min-w-0 rounded-2xl border border-[#dce6dd] bg-white p-3 sm:p-4">
            <dt className="truncate text-[11px] font-semibold text-[#809087] sm:text-xs">
              Registered farmers
            </dt>
            <dd className="mt-1 truncate text-lg font-bold sm:text-2xl">
              {suppliers.length}
            </dd>
          </div>
          <div className="min-w-0 rounded-2xl border border-[#dce6dd] bg-white p-3 sm:p-4">
            <dt className="truncate text-[11px] font-semibold text-[#809087] sm:text-xs">
              Default price per litre
            </dt>
            <dd className="mt-1 truncate text-lg font-bold sm:text-2xl">
              {pricePerLitre === null ? "—" : money(pricePerLitre)}
            </dd>
          </div>
          <Link
            href="/payments"
            className={`min-w-0 rounded-2xl bg-[#17372d] p-3 text-white transition hover:bg-[#1f4a3b] sm:p-4 ${focusRing}`}
          >
            <span className="block truncate text-[11px] font-semibold text-[#b7cabd] sm:text-xs">
              Owed to suppliers
            </span>
            <span className="mt-1 block truncate text-lg font-bold sm:text-2xl">
              {totalOwed === null ? "—" : money(totalOwed)}
            </span>
          </Link>
        </dl>

        {notice && (
          <div
            role="status"
            className={`mt-6 flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm font-semibold sm:px-5 ${
              notice.type === "success"
                ? "border-[#c8dfbd] bg-[#edf7e9] text-[#285b38]"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {notice.type === "success" ? <CheckIcon /> : <AlertIcon />}
            <span className="min-w-0 break-words">{notice.text}</span>
          </div>
        )}

        <div
          id="workspace"
          className="mt-6 grid scroll-mt-6 items-start gap-5 sm:gap-6 xl:grid-cols-[1.4fr_.6fr]"
        >
          {/* Record a collection */}
          <Card className="min-w-0 border-[#cfe0d0]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={eyebrow}>Milk intake</p>
                <h2 className="mt-2 text-xl font-bold sm:text-2xl">
                  Record a collection
                </h2>
              </div>
              <span className="shrink-0 rounded-full bg-[#eef6eb] px-3 py-1 text-xs font-bold text-[#3e7c48]">
                Live workflow
              </span>
            </div>
            <form
              onSubmit={recordMilk}
              className="mt-6 grid gap-4 md:grid-cols-2"
            >
              <label className="text-sm font-semibold md:col-span-2">
                Farmer
                <select
                  value={selectedSupplier}
                  onChange={(event) => setSelectedSupplier(event.target.value)}
                  required
                  className={selectClass}
                >
                  <option value="">Choose a supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.full_name} · {supplier.supplier_code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Collection date
                <Input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
              </label>
              <label className="text-sm font-semibold">
                Quantity (litres)
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  required
                  placeholder="e.g. 28.5"
                />
              </label>
              <label className="text-sm font-semibold">
                Session
                <select
                  value={sessionType}
                  onChange={(event) => setSessionType(event.target.value)}
                  className={selectClass}
                >
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                </select>
              </label>
              <Button type="submit" className="self-end">
                Save milk record
              </Button>
            </form>
          </Card>

          <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
            {/* Default price */}
            <form
              id="pricing"
              onSubmit={savePrice}
              className="scroll-mt-6 rounded-2xl border border-[#cfe0d0] bg-white p-5"
            >
              <p className={eyebrow}>Pricing</p>
              <h2 className="mt-2 text-xl font-bold">Default price per litre</h2>
              <p className="mt-1 text-sm leading-6 text-[#71847a]">
                Applies to every supplier unless you set a custom price on their
                profile.
              </p>
              <label className="mt-4 block text-sm font-semibold">
                Price (KSh)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={priceInput}
                  onChange={(event) => setPriceInput(event.target.value)}
                  placeholder="e.g. 65"
                  className="mt-2 w-full rounded-xl border border-[#dce6dd] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#5a9960] focus:ring-2 focus:ring-[#5a9960]/20"
                />
              </label>
              <button
                type="submit"
                disabled={savingPrice}
                className={`mt-3 w-full rounded-xl bg-[#0a6b48] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#085a3d] disabled:opacity-60 ${focusRing}`}
              >
                {savingPrice ? "Saving..." : "Save price"}
              </button>
            </form>

            {/* Reports moved to their own page */}
            <div className="rounded-2xl border border-[#dce6dd] bg-white p-5">
              <p className={eyebrow}>Reports</p>
              <h2 className="mt-2 text-xl font-bold">Supplier reports</h2>
              <p className="mt-1 text-sm leading-6 text-[#71847a]">
                Generate, preview, download or email a supplier&apos;s report for
                any period.
              </p>
              <Link
                href="/reports"
                className={`mt-4 block rounded-xl border border-[#c8d8cb] px-5 py-3 text-center text-sm font-bold transition hover:border-[#5a9960] ${focusRing}`}
              >
                Open reports
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
