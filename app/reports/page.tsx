"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SupplierSelect } from "../../components/supplier-select";
import {
  API,
  formatDate,
  litres,
  money,
  request,
  useManagerToken,
} from "../../lib/manager-api";

type Supplier = {
  id: string;
  supplier_code: string;
  full_name: string;
  email: string;
  is_active?: boolean | null;
};
type Report = {
  from: string;
  to: string;
  totalLitres: number;
  pricePerLitre: number | null;
  totalCost: number;
  deliveryCount: number;
  supplier: { name: string; code: string; email: string } | null;
  deliveries: Array<{
    id: string;
    session_date: string;
    session_type: string;
    quantity_litres: number | string;
    price_per_litre: number;
    amount: number;
  }>;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a6b48]";
const field =
  "mt-2 w-full rounded-xl border border-[#dce6dd] bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-[#9aa89f] focus:border-[#5a9960] focus:ring-2 focus:ring-[#5a9960]/20";
const eyebrow = "text-xs font-bold uppercase tracking-[.15em] text-[#5a9960]";
const card = "rounded-2xl border border-[#dce6dd] bg-white p-5 sm:p-6";
const primaryBtn = `inline-flex items-center justify-center gap-2 rounded-xl bg-[#0a6b48] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#085a3d] disabled:opacity-60 ${focusRing}`;
const secondaryBtn = `inline-flex items-center justify-center gap-2 rounded-xl border border-[#c8d8cb] bg-white px-5 py-2.5 text-sm font-bold text-[#17372d] transition hover:border-[#5a9960] disabled:opacity-60 ${focusRing}`;

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "This month" },
  { id: "last-month", label: "Last month" },
] as const;

function presetRange(id: (typeof PRESETS)[number]["id"]) {
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (id === "today") return { from: ymd(todayDate), to: ymd(todayDate) };
  if (id === "week")
    return {
      from: ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)),
      to: ymd(todayDate),
    };
  if (id === "month")
    return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(todayDate) };
  return {
    from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)),
  };
}

export default function ReportsPage() {
  const router = useRouter();
  const token = useManagerToken();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [supplierId, setSupplierId] = useState("");
  // Reports are usually for a month, so start there
  const [from, setFrom] = useState(() => {
    const now = new Date();
    return ymd(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [to, setTo] = useState(() => ymd(new Date()));

  const [report, setReport] = useState<Report | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "generate" | "preview" | "download" | "email">("");
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (token === null) router.replace("/");
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    request<{ data: Supplier[] }>("/admin/suppliers?include=all", token)
      .then(({ data }) =>
        setSuppliers([...data].sort((a, b) => a.full_name.localeCompare(b.full_name))),
      )
      .catch((e) => setNotice({ text: e instanceof Error ? e.message : "Could not load suppliers", error: true }))
      .finally(() => setLoadingSuppliers(false));
  }, [token]);

  useEffect(() => {
    if (!suppliers.length) return;
    const wanted = new URLSearchParams(window.location.search).get("supplier");
    if (wanted && suppliers.some((s) => s.id === wanted)) setSupplierId((current) => current || wanted);
  }, [suppliers]);

  // Free the PDF from memory when it is replaced or the page closes
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const selected = suppliers.find((s) => s.id === supplierId);

  // Changing the supplier or the dates makes the old report and PDF out of date
  function clearOutput() {
    setReport(null);
    setPdfUrl(null);
  }
  const notify = (text: string, error = false) => setNotice({ text, error });

  function validate() {
    if (!supplierId) {
      notify("Choose a supplier first.", true);
      return false;
    }
    if (!from || !to || from > to) {
      notify("Choose a valid period: the start date must not be after the end date.", true);
      return false;
    }
    return true;
  }

  async function generate() {
    if (!token || !validate()) return;
    setBusy("generate");
    setNotice(null);
    setPdfUrl(null);
    try {
      const response = await request<{ data: Report }>(
        `/reports?from=${from}&to=${to}&supplierProfileId=${supplierId}`,
        token,
      );
      setReport(response.data);
    } catch (e) {
      setReport(null);
      notify(e instanceof Error ? e.message : "Could not generate the report", true);
    } finally {
      setBusy("");
    }
  }

  // Fetches the PDF from the server (or re-uses the one already loaded)
  async function loadPdf(): Promise<string | null> {
    if (pdfUrl) return pdfUrl;
    if (!token) return null;
    const response = await fetch(
      `${API}/reports/pdf?from=${from}&to=${to}&supplierProfileId=${supplierId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      notify("Could not prepare the PDF.", true);
      return null;
    }
    const url = URL.createObjectURL(await response.blob());
    setPdfUrl(url);
    return url;
  }

  async function preview() {
    if (!report) return;
    setBusy("preview");
    try {
      if (await loadPdf()) {
        notify("Preview ready. Review it before downloading or emailing.");
        setTimeout(
          () => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
          80,
        );
      }
    } finally {
      setBusy("");
    }
  }

  async function download() {
    if (!report) return;
    setBusy("download");
    try {
      const url = await loadPdf();
      if (!url) return;
      const link = document.createElement("a");
      link.href = url;
      link.download = `superleo-report-${selected?.supplier_code || "supplier"}-${report.from}-to-${report.to}.pdf`;
      link.click();
      notify("PDF downloaded.");
    } finally {
      setBusy("");
    }
  }

  async function emailReport() {
    if (!token || !report || !selected) return;
    if (!confirm(`Email this report to ${selected.full_name} at ${selected.email}?`)) return;
    setBusy("email");
    try {
      await request("/reports/email", token, {
        method: "POST",
        body: JSON.stringify({
          from: report.from,
          to: report.to,
          supplierEmail: selected.email,
          supplierProfileId: selected.id,
        }),
      });
      notify(`Report sent to ${selected.email}.`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "The email could not be sent", true);
    } finally {
      setBusy("");
    }
  }

  if (token === undefined || token === null)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f7f2] px-4 text-sm font-semibold text-[#17372d]">
        Checking access...
      </main>
    );

  return (
    <main className="min-h-screen bg-[#f4f7f2] text-[#17372d]">
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 md:px-12">
        <p className={eyebrow}>Reports</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Supplier reports</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#71847a] sm:text-base">
          Pick a supplier and a period. Reports show each delivery, the rate it was paid at, and the
          total cost.
        </p>

        {/* Choose supplier + period */}
        <div className={`${card} mt-6`}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <span className="text-sm font-bold">Supplier</span>
              <div className="mt-2">
                <SupplierSelect
                  options={suppliers}
                  value={supplierId}
                  loading={loadingSuppliers}
                  onChange={(id) => {
                    setSupplierId(id);
                    clearOutput();
                  }}
                />
              </div>
            </div>

            <label className="text-sm font-bold">
              From
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => {
                  setFrom(e.target.value);
                  clearOutput();
                }}
                className={field}
              />
            </label>
            <label className="text-sm font-bold">
              To
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => {
                  setTo(e.target.value);
                  clearOutput();
                }}
                className={field}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#809087]">Quick period:</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  const range = presetRange(preset.id);
                  setFrom(range.from);
                  setTo(range.to);
                  clearOutput();
                }}
                className={`rounded-full border border-[#c8d8cb] px-3 py-1 text-xs font-bold transition hover:border-[#5a9960] hover:text-[#0a6b48] ${focusRing}`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <button type="button" onClick={generate} disabled={busy !== ""} className={primaryBtn}>
              {busy === "generate" ? "Generating..." : "Generate report"}
            </button>
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

        {/* The report */}
        {report && (
          <div className="mt-6">
            <div className={card}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={eyebrow}>Report</p>
                  <h2 className="mt-1 truncate text-xl font-bold">
                    {report.supplier?.name || selected?.full_name || "No records"}
                  </h2>
                  <p className="mt-1 text-sm text-[#71847a]">
                    <span className="font-semibold text-[#5a9960]">
                      {report.supplier?.code || selected?.supplier_code}
                    </span>{" "}
                    · {formatDate(report.from)} to {formatDate(report.to)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={preview} disabled={busy !== ""} className={secondaryBtn}>
                    {busy === "preview" ? "Preparing..." : "Preview PDF"}
                  </button>
                  <button type="button" onClick={download} disabled={busy !== ""} className={secondaryBtn}>
                    {busy === "download" ? "Preparing..." : "Download PDF"}
                  </button>
                  <button type="button" onClick={emailReport} disabled={busy !== ""} className={primaryBtn}>
                    {busy === "email" ? "Sending..." : "Email supplier"}
                  </button>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-[#f4f7f2] p-3.5">
                  <dt className="text-xs text-[#809087]">Deliveries</dt>
                  <dd className="mt-1 text-lg font-bold">{report.deliveryCount}</dd>
                </div>
                <div className="rounded-xl bg-[#f4f7f2] p-3.5">
                  <dt className="text-xs text-[#809087]">Total litres</dt>
                  <dd className="mt-1 text-lg font-bold">{litres(report.totalLitres)}</dd>
                </div>
                <div className="rounded-xl bg-[#f4f7f2] p-3.5">
                  <dt className="text-xs text-[#809087]">Rate per litre</dt>
                  <dd className="mt-1 text-lg font-bold">
                    {report.pricePerLitre === null ? "Varies" : money(report.pricePerLitre)}
                  </dd>
                </div>
                <div className="rounded-xl bg-[#17372d] p-3.5 text-white">
                  <dt className="text-xs text-[#b7cabd]">Total cost</dt>
                  <dd className="mt-1 truncate text-lg font-bold">{money(report.totalCost)}</dd>
                </div>
              </dl>
            </div>

            {/* Deliveries in this report */}
            <div className={`${card} mt-4 !p-0`}>
              <div className="p-5 pb-3 sm:p-6 sm:pb-3">
                <h3 className="text-lg font-bold">Deliveries</h3>
              </div>
              {report.deliveries.length ? (
                <div className="overflow-x-auto border-t border-[#edf2ed]">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-[#f4f7f2] text-xs uppercase tracking-wider text-[#71847a]">
                      <tr>
                        <th className="px-5 py-3 font-bold">Date</th>
                        <th className="px-2 py-3 font-bold">Session</th>
                        <th className="px-2 py-3 text-right font-bold">Litres</th>
                        <th className="px-2 py-3 text-right font-bold">Rate</th>
                        <th className="px-5 py-3 text-right font-bold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.deliveries.map((d) => (
                        <tr key={d.id} className="border-t border-[#edf2ed]">
                          <td className="whitespace-nowrap px-5 py-3">{formatDate(d.session_date)}</td>
                          <td className="px-2 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                                String(d.session_type).toLowerCase() === "evening"
                                  ? "bg-[#f4eee2] text-[#9a7440]"
                                  : "bg-[#eef6eb] text-[#3e7c48]"
                              }`}
                            >
                              {d.session_type}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                            {litres(d.quantity_litres)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums text-[#71847a]">
                            {money(d.price_per_litre)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right font-bold tabular-nums">
                            {money(d.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#dce6dd] bg-[#f9fbf8] font-bold">
                        <td className="px-5 py-3" colSpan={2}>
                          Total
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                          {litres(report.totalLitres)}
                        </td>
                        <td />
                        <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">
                          {money(report.totalCost)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="border-t border-[#edf2ed] px-5 py-10 text-center text-sm text-[#809087]">
                  No deliveries in this period.
                </p>
              )}
            </div>
          </div>
        )}

        {/* PDF preview */}
        {pdfUrl && (
          <div ref={previewRef} className={`${card} mt-4 scroll-mt-6`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={eyebrow}>Document preview</p>
                <h3 className="mt-1 text-lg font-bold">Review the PDF</h3>
              </div>
              <button type="button" onClick={download} disabled={busy !== ""} className={primaryBtn}>
                Download PDF
              </button>
            </div>
            <iframe
              title="Supplier report PDF preview"
              src={pdfUrl}
              className="mt-4 h-[70svh] min-h-[420px] w-full rounded-2xl border border-[#dce6dd] bg-[#f4f7f2]"
            />
          </div>
        )}
      </section>
    </main>
  );
}
