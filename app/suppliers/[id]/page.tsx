"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ManagerHeader } from "../../../components/manager-header";
import {
  formatDate,
  isActive,
  litres,
  request,
  useManagerToken,
  type SupplierRow,
} from "../../../lib/manager-api";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a6b48]";
const field =
  "mt-2 w-full rounded-xl border border-[#dce6dd] bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#5a9960] focus:ring-2 focus:ring-[#5a9960]/20";
const eyebrow = "text-xs font-bold uppercase tracking-[.15em] text-[#5a9960]";

export default function SupplierProfilePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const token = useManagerToken();

  const [supplier, setSupplier] = useState<SupplierRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (token === null) router.replace("/");
  }, [token, router]);

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    request<{ data: SupplierRow }>(`/admin/suppliers/${id}`, token)
      .then(({ data }) => setSupplier(data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load supplier"),
      )
      .finally(() => setLoading(false));
  }, [token, id]);

  const notify = (text: string, error = false) => setNotice({ text, error });

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !supplier) return;
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const address = String(form.get("address") || "").trim();
    setSaving(true);
    try {
      await request(`/admin/suppliers/${supplier.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ fullName, phone, address }),
      });
      setSupplier({
        ...supplier,
        full_name: fullName || supplier.full_name,
        phone: phone || null,
        address: address || null,
      });
      setEditing(false);
      notify("Supplier profile updated.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not save changes", true);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (!token || !supplier) return;
    const active = isActive(supplier);
    const message = active
      ? `Deactivate ${supplier.full_name}? They will be hidden from new milk records. Their existing records are kept.`
      : `Activate ${supplier.full_name}? They will be available for new milk records again.`;
    if (!confirm(message)) return;
    try {
      await request(`/admin/suppliers/${supplier.id}/status`, token, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !active }),
      });
      setSupplier({ ...supplier, is_active: !active });
      notify(active ? "Supplier deactivated." : "Supplier activated.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not update status", true);
    }
  }

  async function deleteSupplier() {
    if (!token || !supplier) return;
    const typed = prompt(
      `This permanently deletes ${supplier.full_name} and all ${supplier.records_count} of their milk records. This cannot be undone.\n\nType ${supplier.supplier_code} to confirm.`,
    );
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== supplier.supplier_code.toUpperCase()) {
      notify("Supplier code did not match. Nothing was deleted.", true);
      return;
    }
    try {
      await request(`/admin/suppliers/${supplier.id}?permanent=true`, token, {
        method: "DELETE",
      });
      router.replace("/suppliers");
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Could not delete supplier",
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
            Loading supplier...
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

  const active = isActive(supplier);
  const details = [
    { label: "Email", value: supplier.email },
    { label: "Phone", value: supplier.phone },
    { label: "Address", value: supplier.address },
    {
      label: "Member since",
      value: supplier.created_at ? formatDate(supplier.created_at) : null,
    },
  ];

  return (
    <main className="min-h-screen bg-[#f4f7f2] text-[#17372d]">
      <ManagerHeader active="suppliers" />

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 md:px-12">
        <Link
          href="/suppliers"
          className={`inline-flex items-center gap-1.5 rounded-lg text-sm font-bold text-[#0a6b48] hover:underline ${focusRing}`}
        >
          <span aria-hidden>←</span> All suppliers
        </Link>

        {/* Identity */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[#dce6dd] bg-white p-5 sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <span
              aria-hidden
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#dceccd] text-xl font-bold uppercase text-[#0a6b48]"
            >
              {supplier.full_name.charAt(0)}
            </span>
            <div className="min-w-0">
              <p className={eyebrow}>Supplier profile</p>
              <h1 className="mt-1 truncate text-2xl font-bold tracking-tight">
                {supplier.full_name}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#71847a]">
                <span className="font-semibold text-[#5a9960]">
                  {supplier.supplier_code}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                    active
                      ? "bg-[#eef6eb] text-[#3e7c48]"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {active ? "Active" : "Inactive"}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/suppliers/${supplier.id}/records`}
              className={`rounded-xl bg-[#0a6b48] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#085a3d] ${focusRing}`}
            >
              View records
            </Link>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={`rounded-xl border border-[#c8d8cb] px-4 py-2.5 text-sm font-bold transition hover:border-[#5a9960] ${focusRing}`}
              >
                Edit profile
              </button>
            )}
          </div>
        </div>

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

        {/* Stats */}
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-[#dce6dd] bg-white p-4 sm:p-5">
            <dt className="text-xs text-[#809087] sm:text-sm">Milk records</dt>
            <dd className="mt-1 text-2xl font-bold">
              {supplier.records_count}
            </dd>
          </div>
          <div className="rounded-2xl border border-[#dce6dd] bg-white p-4 sm:p-5">
            <dt className="text-xs text-[#809087] sm:text-sm">
              Total supplied
            </dt>
            <dd className="mt-1 text-2xl font-bold">
              {litres(supplier.total_litres)}
            </dd>
          </div>
        </dl>

        {/* Details / edit */}
        <div className="mt-4 rounded-2xl border border-[#dce6dd] bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold">
            {editing ? "Edit profile" : "Contact details"}
          </h2>
          {editing ? (
            <form
              onSubmit={saveProfile}
              className="mt-4 grid gap-4 sm:grid-cols-2"
            >
              <label className="text-sm font-bold">
                Full name
                <input
                  name="fullName"
                  defaultValue={supplier.full_name}
                  required
                  className={field}
                />
              </label>
              <label className="text-sm font-bold">
                Phone
                <input
                  name="phone"
                  defaultValue={supplier.phone || ""}
                  className={field}
                />
              </label>
              <label className="text-sm font-bold sm:col-span-2">
                Address
                <input
                  name="address"
                  defaultValue={supplier.address || ""}
                  className={field}
                />
              </label>
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className={`rounded-xl bg-[#0a6b48] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#085a3d] disabled:opacity-60 ${focusRing}`}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className={`rounded-xl border border-[#c8d8cb] px-5 py-2.5 text-sm font-bold transition hover:border-[#5a9960] ${focusRing}`}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {details.map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="text-xs text-[#809087]">{item.label}</dt>
                  <dd className="mt-0.5 break-words text-sm font-semibold">
                    {item.value || (
                      <span className="font-normal text-[#9aa89f]">
                        Not added
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Account actions */}
        <div className="mt-4 rounded-2xl border border-[#dce6dd] bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold">Account</h2>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold">
                {active ? "Deactivate supplier" : "Activate supplier"}
              </p>
              <p className="mt-0.5 text-sm text-[#71847a]">
                {active
                  ? "Hides them from new milk records. Existing records are kept."
                  : "Makes them available for new milk records again."}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleStatus}
              className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${focusRing} ${
                active
                  ? "border-[#ecd3a8] text-[#9a7440] hover:bg-[#f4eee2]"
                  : "border-[#c8dfbd] text-[#0a6b48] hover:bg-[#eef5e8]"
              }`}
            >
              {active ? "Deactivate" : "Activate"}
            </button>
          </div>
          <div className="mt-5 flex flex-col gap-4 border-t border-[#edf2ed] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-red-700">Delete supplier</p>
              <p className="mt-0.5 text-sm text-[#71847a]">
                Permanently removes the supplier and all their milk records.
                This cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={deleteSupplier}
              className={`shrink-0 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 ${focusRing}`}
            >
              Delete supplier
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
