"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "../../components/ui";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
type Supplier = {
  id: string;
  supplier_code: string;
  full_name: string;
  email: string;
  phone?: string;
  address?: string;
};
type Delivery = {
  id: string;
  quantity_litres: number;
  session_date: string;
  session_type: string;
  full_name: string;
  supplier_code: string;
};
function formatDate(value: string) {
  const text = String(value || "");
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00`)
    : new Date(text);
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : parsed.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}
async function request<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });
  if (!response.ok)
    throw new Error((await response.json()).error || "Request failed");
  return response.json();
}

/* ---------- presentation helpers (no logic) ---------- */
const eyebrow = "text-xs font-bold uppercase tracking-[.15em] text-[#5a9960]";
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a6b48]";
const navLink = `rounded-full px-3 py-1.5 text-sm font-bold transition ${focusRing}`;

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="size-5 shrink-0"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 10-1.4 1.4l2 2a1 1 0 001.4 0l4-4z"
      />
    </svg>
  );
}

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("superleo_manager_token")
      : null;
  useEffect(() => {
    if (!token) return router.replace("/");
    request<{ data: Supplier[] }>("/admin/suppliers", token)
      .then(({ data }) => setSuppliers(data))
      .catch(() => router.replace("/"));
  }, [router, token]);
  async function showRecords(supplier: Supplier) {
    if (!token) return;
    const response = await request<{ data: Delivery[] }>(
      `/deliveries?supplierId=${supplier.id}`,
      token,
    );
    setDeliveries(response.data);
    setEditing(supplier);
  }
  async function saveSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !editing) return;
    const form = new FormData(event.currentTarget);
    await request(`/admin/suppliers/${editing.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({
        fullName: form.get("fullName"),
        phone: form.get("phone"),
        address: form.get("address"),
      }),
    });
    setSuppliers((items) =>
      items.map((item) =>
        item.id === editing.id
          ? {
              ...item,
              full_name: String(form.get("fullName")),
              phone: String(form.get("phone")),
              address: String(form.get("address")),
            }
          : item,
      ),
    );
    setNotice("Supplier profile updated.");
    setEditing(null);
  }
  async function deleteSupplier(id: string) {
    if (!token || !confirm("Deactivate this supplier profile?")) return;
    await request(`/admin/suppliers/${id}`, token, { method: "DELETE" });
    setSuppliers((items) => items.filter((item) => item.id !== id));
    setNotice("Supplier profile deactivated.");
  }
  async function deleteDelivery(id: string) {
    if (!token || !confirm("Delete this milk record permanently?")) return;
    await request(`/deliveries/${id}`, token, { method: "DELETE" });
    setDeliveries((items) => items.filter((item) => item.id !== id));
    setNotice("Milk record deleted.");
  }
  async function editDelivery(delivery: Delivery) {
    if (!token) return;
    const quantity = prompt(
      "Quantity in litres",
      String(delivery.quantity_litres),
    );
    if (!quantity) return;
    await request(`/deliveries/${delivery.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ quantityLitres: Number(quantity) }),
    });
    setDeliveries((items) =>
      items.map((item) =>
        item.id === delivery.id
          ? { ...item, quantity_litres: Number(quantity) }
          : item,
      ),
    );
    setNotice("Milk record updated.");
  }
  function logout() {
    localStorage.removeItem("superleo_manager_token");
    router.replace("/");
  }
  return (
    <main className="min-h-screen bg-[#f4f7f2] text-[#17372d]">
      <header className="sticky top-0 z-20 border-b border-[#dce6dd] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 md:h-20 md:px-12">
          <a
            href="/dashboard"
            aria-label="SuperLeo manager home"
            className={`flex min-w-0 items-center gap-3 rounded-lg ${focusRing}`}
          >
            {/* logo.png lives in your app's /public folder */}
            <img
              src="/logo.png"
              alt="SuperLeo"
              className="h-8 w-auto shrink-0 sm:h-10"
            />
            <span className="hidden rounded-full bg-[#dceccd] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#285b38] sm:inline">
              Directory
            </span>
          </a>

          {/* Desktop navigation */}
          <div className="hidden items-center gap-3 md:flex">
            <nav aria-label="Main" className="flex items-center gap-1">
              <a
                href="/dashboard"
                className={`${navLink} text-[#64766b] hover:bg-[#eef5e8] hover:text-[#0a6b48]`}
              >
                Overview
              </a>
              <a
                href="/suppliers"
                aria-current="page"
                className={`${navLink} bg-[#dceccd] text-[#0a6b48]`}
              >
                Suppliers
              </a>
            </nav>
            <button
              type="button"
              onClick={logout}
              className={`rounded-full border border-[#c8d8cb] px-4 py-1.5 text-sm font-bold text-[#17372d] transition hover:bg-[#17372d] hover:text-white ${focusRing}`}
            >
              Log out
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="manager-menu"
            className={`-mr-2 flex size-10 items-center justify-center rounded-xl text-[#17372d] transition hover:bg-[#eef5e8] md:hidden ${focusRing}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="size-6"
              aria-hidden
            >
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div
            id="manager-menu"
            className="border-t border-[#dce6dd] bg-white px-4 py-3 md:hidden"
          >
            <nav
              aria-label="Mobile"
              className="flex flex-col gap-1 text-sm font-bold"
            >
              <a
                href="/dashboard"
                className="rounded-xl px-3 py-3 text-[#17372d] hover:bg-[#f2f7f0]"
              >
                Overview
              </a>
              <a
                href="/suppliers"
                aria-current="page"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl bg-[#dceccd] px-3 py-3 text-[#0a6b48]"
              >
                Suppliers
              </a>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl px-3 py-3 text-left text-red-700 hover:bg-red-50"
              >
                Log out
              </button>
            </nav>
          </div>
        )}
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 md:px-12">
        {/* Page heading */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className={eyebrow}>Directory</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              All suppliers
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71847a] sm:text-base">
              Edit profiles, review delivery history, and keep your records
              accurate.
            </p>
          </div>
          <div className="rounded-xl bg-[#dceccd] px-4 py-3 text-sm font-bold text-[#285b38]">
            {suppliers.length} active suppliers
          </div>
        </div>

        {notice && (
          <div
            role="status"
            className="mt-6 flex items-start gap-3 rounded-2xl border border-[#c8dfbd] bg-[#edf7e9] px-4 py-3.5 text-sm font-semibold text-[#285b38] sm:px-5"
          >
            <CheckIcon />
            <span className="min-w-0 break-words">{notice}</span>
          </div>
        )}

        <div className="mt-6 grid gap-5 sm:gap-6 lg:grid-cols-[1fr_1.2fr]">
          {/* Supplier list */}
          <Card className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Supplier profiles</h2>
              <span className="rounded-full bg-[#eef6eb] px-3 py-1 text-xs font-bold text-[#3e7c48]">
                {suppliers.length}
              </span>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              {suppliers.map((supplier) => {
                const selected = editing?.id === supplier.id;
                return (
                  <div
                    key={supplier.id}
                    className={`rounded-2xl border p-4 transition ${
                      selected
                        ? "border-[#5a9960] bg-[#f2f8ee]"
                        : "border-[#e3ece2] hover:border-[#c8dfbd]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden
                          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#dceccd] text-sm font-bold uppercase text-[#0a6b48]"
                        >
                          {supplier.full_name.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-bold">
                            {supplier.full_name}
                          </p>
                          <p className="truncate text-sm text-[#71847a]">
                            <span className="font-semibold text-[#5a9960]">
                              {supplier.supplier_code}
                            </span>{" "}
                            · {supplier.email}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteSupplier(supplier.id)}
                        className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-red-700 transition hover:bg-red-50 ${focusRing}`}
                      >
                        Deactivate
                      </button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => showRecords(supplier)}
                        className={`rounded-xl bg-[#0a6b48] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#085a3d] ${focusRing}`}
                      >
                        View records
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(supplier)}
                        className={`rounded-xl border border-[#c8d8cb] bg-white px-4 py-2 text-sm font-bold text-[#17372d] transition hover:border-[#5a9960] ${focusRing}`}
                      >
                        Edit profile
                      </button>
                    </div>
                  </div>
                );
              })}
              {!suppliers.length && (
                <p className="rounded-2xl border border-dashed border-[#c8d8cb] py-10 text-center text-sm text-[#71847a]">
                  No active suppliers yet.
                </p>
              )}
            </div>
          </Card>

          <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
            {/* Edit profile */}
            <Card>
              <p className={eyebrow}>Profile</p>
              <h2 className="mt-2 text-xl font-bold">
                {editing ? `Edit ${editing.full_name}` : "Select a supplier"}
              </h2>
              {!editing && (
                <p className="mt-2 text-sm leading-6 text-[#71847a]">
                  Choose a supplier from the list to edit their profile or
                  review their milk records.
                </p>
              )}
              {editing && (
                <form
                  key={editing.id}
                  onSubmit={saveSupplier}
                  className="mt-5 grid gap-4 sm:grid-cols-2"
                >
                  <label className="text-sm font-bold">
                    Full name
                    <Input
                      name="fullName"
                      defaultValue={editing.full_name}
                      required
                    />
                  </label>
                  <label className="text-sm font-bold">
                    Phone
                    <Input name="phone" defaultValue={editing.phone} />
                  </label>
                  <label className="text-sm font-bold sm:col-span-2">
                    Address
                    <Input name="address" defaultValue={editing.address} />
                  </label>
                  <div className="flex flex-wrap gap-3 sm:col-span-2">
                    <Button type="submit">Save changes</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </Card>

            {/* Milk records */}
            <Card className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={eyebrow}>Milk records</p>
                  <h2 className="mt-2 truncate text-xl font-bold">
                    {editing?.full_name || "Choose a supplier"}
                  </h2>
                </div>
                {editing && (
                  <span className="shrink-0 rounded-full bg-[#eef6eb] px-3 py-1 text-xs font-bold text-[#3e7c48]">
                    {deliveries.length} records
                  </span>
                )}
              </div>
              {!editing && (
                <p className="mt-2 text-sm leading-6 text-[#71847a]">
                  Records appear here once you pick a supplier.
                </p>
              )}
              {editing && (
                <div className="mt-5 overflow-x-auto rounded-2xl border border-[#e3ece2]">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead className="bg-[#f4f7f2] text-xs uppercase tracking-wider text-[#71847a]">
                      <tr>
                        <th className="px-4 py-3 font-bold">Date</th>
                        <th className="px-2 py-3 font-bold">Session</th>
                        <th className="px-2 py-3 font-bold">Quantity</th>
                        <th className="px-4 py-3 text-right font-bold">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.map((delivery) => (
                        <tr
                          key={delivery.id}
                          className="border-t border-[#edf2ed] transition hover:bg-[#f9fbf8]"
                        >
                          <td className="whitespace-nowrap px-4 py-3">
                            {formatDate(delivery.session_date)}
                          </td>
                          <td className="px-2 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                                delivery.session_type === "evening"
                                  ? "bg-[#f4eee2] text-[#9a7440]"
                                  : "bg-[#eef6eb] text-[#3e7c48]"
                              }`}
                            >
                              {delivery.session_type}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-3 font-bold">
                            {delivery.quantity_litres} L
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => editDelivery(delivery)}
                              className={`mr-1 rounded-lg px-2 py-1 font-bold text-[#0a6b48] transition hover:bg-[#eef5e8] ${focusRing}`}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteDelivery(delivery.id)}
                              className={`rounded-lg px-2 py-1 font-bold text-red-700 transition hover:bg-red-50 ${focusRing}`}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!deliveries.length && (
                    <p className="border-t border-[#edf2ed] py-8 text-center text-sm text-[#71847a]">
                      No delivery records yet.
                    </p>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
