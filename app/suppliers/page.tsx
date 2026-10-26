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
  const raw = String(value || "").slice(0, 10);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00`)
    : new Date(value);
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
export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [notice, setNotice] = useState("");
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
  return (
    <main className="min-h-screen bg-[#f4f7f2] text-[#17372d]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#315847] bg-[#17372d] px-6 py-5 text-white md:px-12">
        <div>
          <a href="/dashboard" className="text-lg font-bold">
            SuperLeo Manager
          </a>
          <p className="text-xs text-[#b7cabd]">Supplier directory</p>
        </div>
        <div className="flex gap-3">
          <a
            href="/dashboard"
            className="rounded-xl px-4 py-3 text-sm font-bold text-[#dceccd]"
          >
            Overview
          </a>
          <Button
            onClick={() => {
              localStorage.removeItem("superleo_manager_token");
              router.replace("/");
            }}
            className="bg-white text-[#17372d]"
          >
            Log out
          </Button>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-6 py-10 md:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#5a9960]">
              Directory
            </p>
            <h1 className="mt-3 text-4xl font-bold">All suppliers</h1>
            <p className="mt-3 text-[#71847a]">
              Edit profiles, review delivery history, and keep your records
              accurate.
            </p>
          </div>
          <div className="rounded-2xl bg-[#dceccd] px-5 py-4 font-bold text-[#285b38]">
            {suppliers.length} active suppliers
          </div>
        </div>
        {notice && (
          <div className="mt-6 rounded-2xl border border-[#c8dfbd] bg-[#edf7e9] px-5 py-4 text-sm font-bold text-[#285b38]">
            {notice}
          </div>
        )}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Card>
            <h2 className="text-xl font-bold">Supplier profiles</h2>
            <div className="mt-5 flex flex-col gap-3">
              {suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="rounded-2xl border border-[#e3ece2] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{supplier.full_name}</p>
                      <p className="text-sm text-[#71847a]">
                        {supplier.supplier_code} · {supplier.email}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteSupplier(supplier.id)}
                      className="text-xs font-bold text-red-700"
                    >
                      Deactivate
                    </button>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => showRecords(supplier)}
                      className="px-3 py-2"
                    >
                      View records
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditing(supplier)}
                      className="px-3 py-2"
                    >
                      Edit profile
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <div className="flex flex-col gap-6">
            <Card>
              <h2 className="text-xl font-bold">
                {editing ? `Edit ${editing.full_name}` : "Select a supplier"}
              </h2>
              {editing && (
                <form
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
                  <div className="flex gap-3">
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
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.15em] text-[#5a9960]">
                    Milk records
                  </p>
                  <h2 className="mt-2 text-xl font-bold">
                    {editing?.full_name || "Choose a supplier"}
                  </h2>
                </div>
                {editing && (
                  <span className="rounded-full bg-[#eef6eb] px-3 py-1 text-xs font-bold text-[#3e7c48]">
                    {deliveries.length} records
                  </span>
                )}
              </div>
              {editing && (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-[#dce6dd] text-xs uppercase text-[#71847a]">
                      <tr>
                        <th className="py-3">Date</th>
                        <th>Session</th>
                        <th>Quantity</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.map((delivery) => (
                        <tr
                          key={delivery.id}
                          className="border-b border-[#edf2ed]"
                        >
                          <td className="py-3">
                            {new Date(
                              `${delivery.session_date}T00:00:00`,
                            ).toLocaleDateString("en-GB")}
                          </td>
                          <td>{delivery.session_type}</td>
                          <td className="font-bold">
                            {delivery.quantity_litres} L
                          </td>
                          <td className="text-right">
                            <button
                              onClick={() => editDelivery(delivery)}
                              className="mr-3 font-bold text-[#0a6b48]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteDelivery(delivery.id)}
                              className="font-bold text-red-700"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!deliveries.length && (
                    <p className="py-8 text-center text-[#71847a]">
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
