"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "../../components/ui";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
type User = { full_name?: string; email: string; role: "manager" | "admin" };
type Supplier = {
  id: string;
  supplier_code: string;
  full_name: string;
  email: string;
};
type Report = {
  from: string;
  to: string;
  totalLitres: number;
  deliveryCount: number;
  supplier: { name: string; code: string; email: string } | null;
  deliveries: Array<{
    id: string;
    session_date: string;
    session_type: string;
    full_name: string;
    quantity_litres: number;
  }>;
};
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
const today = () => new Date().toISOString().slice(0, 10);

export default function DashboardPage() {
  const router = useRouter();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [date, setDate] = useState(today());
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [quantity, setQuantity] = useState("");
  const [sessionType, setSessionType] = useState("morning");
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem("superleo_manager_token");
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
        localStorage.removeItem("superleo_manager_token");
        router.replace("/");
      })
      .finally(() => setLoading(false));
  }, [router]);
  async function recordMilk(event: FormEvent) {
    event.preventDefault();
    const token = localStorage.getItem("superleo_manager_token");
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
      await generateReport();
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Could not save record",
      });
    }
  }
  async function generateReport() {
    const token = localStorage.getItem("superleo_manager_token");
    if (!token || !selectedSupplier) {
      setNotice({
        type: "error",
        text: "Choose a supplier before generating a report.",
      });
      return;
    }
    try {
      const response = await request<{ data: Report }>(
        `/reports?from=${from}&to=${to}&supplierProfileId=${selectedSupplier}`,
        token,
      );
      setReport(response.data);
      setNotice({
        type: "success",
        text: "Supplier report generated and ready to download.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error ? error.message : "Could not generate report",
      });
    }
  }
  async function emailReport() {
    const token = localStorage.getItem("superleo_manager_token");
    const supplier = suppliers.find((item) => item.id === selectedSupplier);
    if (!token || !supplier || !report) return;
    try {
      await request("/reports/email", token, {
        method: "POST",
        body: JSON.stringify({
          from: report.from,
          to: report.to,
          supplierEmail: supplier.email,
          supplierProfileId: supplier.id,
        }),
      });
      setNotice({ type: "success", text: `Report sent to ${supplier.email}.` });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error ? error.message : "Email could not be sent",
      });
    }
  }
  async function previewPdf() {
    const token = localStorage.getItem("superleo_manager_token");
    if (!token || !selectedSupplier) return;
    const response = await fetch(
      `${API}/reports/pdf?from=${from}&to=${to}&supplierProfileId=${selectedSupplier}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      setNotice({ type: "error", text: "Could not prepare PDF preview." });
      return;
    }
    const blob = await response.blob();
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(URL.createObjectURL(blob));
    setNotice({
      type: "success",
      text: "Report preview ready. Review it before downloading or sharing.",
    });
  }
  function downloadPdf() {
    if (!pdfUrl) return;
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `superleo-report-${from}-${to}.pdf`;
    link.click();
    setNotice({ type: "success", text: "PDF downloaded successfully." });
  }
  if (loading || !user)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f7f2] text-[#17372d]">
        Checking access...
      </main>
    );
  return (
    <main className="min-h-screen bg-[#f4f7f2] text-[#17372d]">
      {pdfUrl && (
        <section className="mx-auto max-w-7xl px-6 pt-6 md:px-12">
          <Card className="border-[#cfe0d0]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.15em] text-[#5a9960]">
                  Document preview
                </p>
                <h2 className="mt-1 text-xl font-bold">Review supplier PDF</h2>
              </div>
              <Button onClick={downloadPdf}>Download PDF</Button>
            </div>
            <iframe
              title="Supplier report PDF preview"
              src={pdfUrl}
              className="mt-5 h-[680px] w-full rounded-2xl border border-[#dce6dd] bg-[#f4f7f2]"
            />
          </Card>
        </section>
      )}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#315847] bg-[#17372d] px-6 py-5 text-white md:px-12">
        <div>
          <strong className="text-lg">SuperLeo Manager</strong>
          <p className="text-xs text-[#b7cabd]">Dairy operations workspace</p>
        </div>
        <nav className="hidden gap-5 text-sm font-bold md:flex">
          <a href="/dashboard" className="text-[#dceccd]">
            Overview
          </a>
          <a href="/suppliers" className="text-[#b7cabd] hover:text-white">
            Suppliers
          </a>
        </nav>
        <Button
          onClick={() => {
            localStorage.removeItem("superleo_manager_token");
            router.replace("/");
          }}
          className="bg-white text-[#17372d] hover:bg-[#edf4ed]"
        >
          Log out
        </Button>
      </header>
      <section className="mx-auto max-w-7xl px-6 py-10 md:px-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#5a9960]">
              {user.role} workspace
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">
              Good morning, {user.full_name || user.email}
            </h1>
            <p className="mt-4 max-w-2xl text-[#71847a]">
              Record collections, keep farmer profiles current, and create
              polished supplier reports.
            </p>
          </div>
          <a
            href="/suppliers"
            className="rounded-2xl bg-[#dceccd] px-5 py-4 text-sm font-bold text-[#285b38]"
          >
            Manage {suppliers.length} farmers →
          </a>
        </div>
        {notice && (
          <div
            role="status"
            className={`mt-7 rounded-2xl border px-5 py-4 text-sm font-bold ${notice.type === "success" ? "border-[#c8dfbd] bg-[#edf7e9] text-[#285b38]" : "border-red-200 bg-red-50 text-red-700"}`}
          >
            {notice.text}
          </div>
        )}
        <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
          <Card className="border-[#cfe0d0]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.15em] text-[#5a9960]">
                  Milk intake
                </p>
                <h2 className="mt-2 text-2xl font-bold">Record a collection</h2>
              </div>
              <span className="rounded-full bg-[#eef6eb] px-3 py-1 text-xs font-bold text-[#3e7c48]">
                Live workflow
              </span>
            </div>
            <form
              onSubmit={recordMilk}
              className="mt-7 grid gap-4 md:grid-cols-2"
            >
              <label className="text-sm font-semibold md:col-span-2">
                Farmer
                <select
                  value={selectedSupplier}
                  onChange={(event) => setSelectedSupplier(event.target.value)}
                  required
                  className="mt-2 w-full rounded-xl border border-[#dce6dd] bg-white px-4 py-3"
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
                  className="mt-2 w-full rounded-xl border border-[#dce6dd] bg-white px-4 py-3"
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
          <Card className="bg-[#17372d] text-white">
            <p className="text-xs font-bold uppercase tracking-[.15em] text-[#b7cabd]">
              Supplier report studio
            </p>
            <h2 className="mt-2 text-2xl font-bold">Generate a clean report</h2>
            <p className="mt-2 text-sm leading-6 text-[#b7cabd]">
              Reports are scoped to one supplier and include their name and code
              once in the header.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-[#dceccd]">
                From
                <Input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </label>
              <label className="text-sm font-semibold text-[#dceccd]">
                To
                <Input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" onClick={generateReport}>
                Generate report
              </Button>
              {report && (
                <>
                  <Button type="button" variant="outline" onClick={previewPdf}>
                    Download PDF
                  </Button>
                  <Button type="button" variant="outline" onClick={emailReport}>
                    Email supplier
                  </Button>
                </>
              )}
            </div>
            {report && (
              <div className="mt-6 rounded-2xl bg-white/10 p-4">
                <p className="font-bold">
                  {report.supplier?.name || "No records yet"}
                </p>
                <p className="mt-1 text-sm text-[#b7cabd]">
                  {report.supplier?.code || ""} · {report.deliveryCount} records
                  · {report.totalLitres.toFixed(2)} L
                </p>
              </div>
            )}
          </Card>
        </div>
      </section>
    </main>
  );
}
