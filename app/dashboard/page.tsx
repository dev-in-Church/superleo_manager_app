"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ---------- presentation helpers (no logic) ---------- */
const eyebrow = "text-xs font-bold uppercase tracking-[.15em] text-[#5a9960]";
const selectClass =
  "mt-2 w-full rounded-xl border border-[#dce6dd] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#5a9960] focus:ring-2 focus:ring-[#5a9960]/20";
const navLink =
  "rounded-full px-3 py-1.5 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a6b48]";

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
function AlertIcon() {
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
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 6a1 1 0 112 0v4a1 1 0 11-2 0V6zm1 8a1 1 0 100-2 1 1 0 000 2z"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

const reportBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition active:scale-[.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#dceccd]";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const previewRef = useRef<HTMLElement>(null);

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

  // Presentation only: bring the preview into view once it is ready
  useEffect(() => {
    if (pdfUrl)
      previewRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }, [pdfUrl]);

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
      <header className="sticky top-0 z-20 border-b border-[#dce6dd] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 md:h-20 md:px-12">
          <a
            href="/dashboard"
            aria-label="SuperLeo manager home"
            className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a6b48]"
          >
            {/* put logo.png in your app's /public folder */}
            <img
              src="/logo.png"
              alt="SuperLeo"
              className="h-8 w-auto shrink-0 sm:h-10"
            />
            <span className="hidden rounded-full bg-[#dceccd] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#285b38] sm:inline">
              {user.role}
            </span>
          </a>

          {/* Desktop navigation */}
          <div className="hidden items-center gap-3 md:flex">
            <nav aria-label="Main" className="flex items-center gap-1">
              <a
                href="/dashboard"
                aria-current="page"
                className={`${navLink} bg-[#dceccd] text-[#0a6b48]`}
              >
                Overview
              </a>
              <a
                href="/suppliers"
                className={`${navLink} text-[#64766b] hover:bg-[#eef5e8] hover:text-[#0a6b48]`}
              >
                Suppliers
              </a>
            </nav>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("superleo_manager_token");
                router.replace("/");
              }}
              className="rounded-full border border-[#c8d8cb] px-4 py-1.5 text-sm font-bold text-[#17372d] transition hover:bg-[#17372d] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a6b48]"
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
            className="-mr-2 flex size-10 items-center justify-center rounded-xl text-[#17372d] transition hover:bg-[#eef5e8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0a6b48] md:hidden"
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

        {/* Mobile menu panel */}
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
                aria-current="page"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl bg-[#dceccd] px-3 py-3 text-[#0a6b48]"
              >
                Overview
              </a>
              <a
                href="/suppliers"
                className="rounded-xl px-3 py-3 text-[#17372d] hover:bg-[#f2f7f0]"
              >
                Suppliers
              </a>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("superleo_manager_token");
                  router.replace("/");
                }}
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
            <p className={eyebrow}>{user.role} workspace</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Overview
            </h1>
            {/* <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">
              Good morning, {user.full_name || user.email}
            </h1> */}
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71847a] sm:text-base">
              Record collections, keep farmer profiles current, and create
              polished supplier reports.
            </p>
          </div>
          <a
            href="/suppliers"
            className="rounded-xl bg-[#dceccd] px-4 py-3 text-sm font-bold text-[#285b38] transition hover:bg-[#cfe3bd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a6b48]"
          >
            Manage {suppliers.length} farmers
          </a>
        </div>

        {/* Quick stats (derived from data already on the page) */}
        <dl className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: "Registered farmers", value: String(suppliers.length) },
            {
              label: "Records in report",
              value: report ? String(report.deliveryCount) : "—",
            },
            {
              label: "Litres in report",
              value: report ? `${report.totalLitres.toFixed(2)} L` : "—",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="min-w-0 rounded-2xl border border-[#dce6dd] bg-white p-3 sm:p-4"
            >
              <dt className="truncate text-[11px] font-semibold text-[#809087] sm:text-xs">
                {stat.label}
              </dt>
              <dd className="mt-1 truncate text-lg font-bold sm:text-2xl">
                {stat.value}
              </dd>
            </div>
          ))}
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

        <div className="mt-6 grid gap-5 sm:gap-6 xl:grid-cols-[1.05fr_.95fr]">
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

          {/* Report studio */}
          <Card className="min-w-0 bg-[#17372d] text-white">
            <p className="text-xs font-bold uppercase tracking-[.15em] text-[#b7cabd]">
              Supplier report studio
            </p>
            <h2 className="mt-2 text-xl font-bold sm:text-2xl">
              Generate a clean report
            </h2>
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
                  <button
                    type="button"
                    onClick={previewPdf}
                    className={`${reportBtn} border border-white/20 bg-[#0a6b48] text-white hover:bg-[#0c7f56]`}
                  >
                    <EyeIcon />
                    Preview PDF
                  </button>
                  <button
                    type="button"
                    onClick={emailReport}
                    className={`${reportBtn} bg-[#dceccd] text-[#17372d] ring-1 ring-inset ring-[#17372d]/15 hover:bg-white`}
                  >
                    <MailIcon />
                    Email supplier
                  </button>
                </>
              )}
            </div>
            {report && (
              <div className="mt-6 rounded-2xl bg-white/10 p-4">
                <p className="truncate font-bold">
                  {report.supplier?.name || "No records yet"}
                </p>
                <p className="mt-0.5 text-xs text-[#b7cabd]">
                  {report.supplier?.code || ""}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
                  <div>
                    <p className="text-xs text-[#b7cabd]">Records</p>
                    <p className="text-lg font-bold">{report.deliveryCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#b7cabd]">Total</p>
                    <p className="text-lg font-bold">
                      {report.totalLitres.toFixed(2)} L
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* PDF preview */}
        {pdfUrl && (
          <section ref={previewRef} className="mt-6 scroll-mt-24 sm:mt-8">
            <Card className="border-[#cfe0d0]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className={eyebrow}>Document preview</p>
                  <h2 className="mt-1 text-xl font-bold">
                    Review supplier PDF
                  </h2>
                </div>
                <Button onClick={downloadPdf}>Download PDF</Button>
              </div>
              <iframe
                title="Supplier report PDF preview"
                src={pdfUrl}
                className="mt-5 h-[70svh] min-h-[420px] w-full rounded-2xl border border-[#dce6dd] bg-[#f4f7f2]"
              />
            </Card>
          </section>
        )}
      </section>
    </main>
  );
}
