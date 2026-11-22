"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  formatDate,
  formatDateTime,
  money,
  request,
  useManagerToken,
} from "../../../../lib/manager-api";

type PaymentStatus = "pending" | "completed" | "failed" | "timeout";
type Payment = {
  id: string;
  amount: number;
  phone: string;
  status: PaymentStatus;
  mpesa_receipt: string | null;
  result_desc: string | null;
  note: string | null;
  initiated_at: string;
  completed_at: string | null;
  receipt_emailed_at: string | null;
};
type Deduction = {
  id: string;
  kind: "feed" | "advance" | "other";
  description: string | null;
  amount: number;
  deduction_date: string;
  voided_at: string | null;
};
type Detail = {
  supplier: {
    id: string;
    supplier_code: string;
    full_name: string;
    phone: string | null;
    mpesa_phone: string | null;
    is_active: boolean | null;
  };
  balance: {
    earned: number;
    deducted: number;
    paid: number;
    balance: number;
    payable: number;
    minAmount: number;
    maxAmount: number;
    startDate: string | null;
  };
  deductions: Deduction[];
  payments: Payment[];
  payoutsEnabled: boolean;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a6b48]";
const field =
  "mt-2 w-full rounded-xl border border-[#dce6dd] bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-[#9aa89f] focus:border-[#5a9960] focus:ring-2 focus:ring-[#5a9960]/20";
const eyebrow = "text-xs font-bold uppercase tracking-[.15em] text-[#5a9960]";
const card = "rounded-2xl border border-[#dce6dd] bg-white p-5 sm:p-6";

const STATUS_STYLE: Record<PaymentStatus, { label: string; className: string }> = {
  completed: { label: "Paid", className: "bg-[#eef6eb] text-[#3e7c48]" },
  pending: { label: "Sending…", className: "bg-[#fbe3b4] text-[#8a5a12]" },
  timeout: { label: "Needs check", className: "bg-[#fbe3b4] text-[#8a5a12]" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700" },
};
const KIND_LABEL = { feed: "Feed", advance: "Advance", other: "Other" } as const;

export default function SupplierPaymentsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const token = useManagerToken();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [paying, setPaying] = useState(false);
  const [addingDeduction, setAddingDeduction] = useState(false);
  const formReady = useRef(false);

  useEffect(() => {
    if (token === null) router.replace("/");
  }, [token, router]);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const response = await request<{ data: Detail }>(`/payments/suppliers/${id}`, token);
      setDetail(response.data);
      setError("");
      // Fill the pay form once; after that the manager's edits are left alone
      if (!formReady.current) {
        formReady.current = true;
        setAmount(String(response.data.balance.payable || ""));
        setPhone(response.data.supplier.phone || "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payments");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  // While a payment is being processed by M-Pesa, check for its result every few seconds
  const waiting = detail?.payments.some((p) => p.status === "pending") ?? false;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [waiting, load]);

  const notify = (text: string, error = false) => setNotice({ text, error });

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !detail) return;
    const value = Math.floor(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      notify("Enter the amount to pay.", true);
      return;
    }
    if (
      !confirm(
        `Send ${money(value)} to ${detail.supplier.full_name} on ${phone || detail.supplier.phone} via M-Pesa?\n\nThis sends real money and cannot be undone.`,
      )
    )
      return;
    setPaying(true);
    try {
      const response = await request<{ data: Payment; message?: string }>(
        `/payments/suppliers/${id}/pay`,
        token,
        { method: "POST", body: JSON.stringify({ amount: value, phone, note }) },
      );
      notify(response.message || "Payment sent to M-Pesa.", response.data.status === "timeout");
      setNote("");
      formReady.current = false; // refill the amount from the new balance
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not send the payment", true);
      await load();
    } finally {
      setPaying(false);
    }
  }

  async function addDeduction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setAddingDeduction(true);
    try {
      const response = await request<{ emailed?: boolean; emailNote?: string }>(`/payments/suppliers/${id}/deductions`, token, {
        method: "POST",
        body: JSON.stringify({
          kind: data.get("kind"),
          description: data.get("description"),
          amount: Number(data.get("amount")),
          date: data.get("date"),
        }),
      });
      form.reset();
      notify(
        response.emailed
          ? "Deduction added and taken off the balance. The supplier was emailed."
          : `Deduction added and taken off the balance, but the supplier could not be emailed${response.emailNote ? `: ${response.emailNote}` : "."}`,
        !response.emailed,
      );
      formReady.current = false;
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not add the deduction", true);
    } finally {
      setAddingDeduction(false);
    }
  }

  async function voidDeduction(deduction: Deduction) {
    if (!token) return;
    if (!confirm(`Remove this ${deduction.kind} deduction of ${money(deduction.amount)}? The balance goes back up.`))
      return;
    try {
      const response = await request<{ emailed?: boolean; emailNote?: string }>(
        `/payments/deductions/${deduction.id}/void`,
        token,
        { method: "POST" },
      );
      notify(
        response.emailed
          ? "Deduction removed. The supplier was emailed."
          : `Deduction removed, but the supplier could not be emailed${response.emailNote ? `: ${response.emailNote}` : "."}`,
        !response.emailed,
      );
      formReady.current = false;
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not remove the deduction", true);
    }
  }

  async function resolve(payment: Payment, outcome: "completed" | "failed") {
    if (!token) return;
    let receipt = "";
    if (outcome === "completed") {
      const entered = prompt(
        `Only do this after confirming on the M-Pesa portal that ${money(payment.amount)} reached ${payment.phone}.\n\nEnter the M-Pesa receipt code:`,
      );
      if (entered === null) return;
      receipt = entered.trim();
    } else if (
      !confirm(
        `Mark this ${money(payment.amount)} payment as FAILED?\n\nOnly do this if you have confirmed on the M-Pesa portal that the money was NOT sent. Otherwise the supplier could be paid twice.`,
      )
    )
      return;
    try {
      const response = await request<{ emailed?: boolean; emailNote?: string }>(
        `/payments/${payment.id}/resolve`,
        token,
        { method: "POST", body: JSON.stringify({ outcome, receipt }) },
      );
      notify(
        outcome === "failed"
          ? "Payment marked as failed."
          : response.emailed
            ? "Payment marked as paid. The receipt was emailed to the supplier."
            : `Payment marked as paid, but the receipt could not be emailed${response.emailNote ? `: ${response.emailNote}` : "."}`,
        outcome === "completed" && !response.emailed,
      );
      formReady.current = false;
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not update the payment", true);
    }
  }

  async function sendReceipt(payment: Payment) {
    if (!token) return;
    try {
      await request(`/payments/${payment.id}/receipt`, token, { method: "POST" });
      notify("Receipt emailed to the supplier.");
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not email the receipt", true);
    }
  }

  if (token === undefined || token === null || loading)
    return (
      <main className="min-h-screen bg-[#f4f7f2] text-[#17372d]">
        <div className="grid place-items-center px-4 py-32 text-sm font-semibold">
          <span className="flex items-center gap-3">
            <span
              aria-hidden
              className="size-5 animate-spin rounded-full border-2 border-[#b7d3b6] border-t-[#0a6b48]"
            />
            Loading payments...
          </span>
        </div>
      </main>
    );

  if (error || !detail)
    return (
      <main className="min-h-screen bg-[#f4f7f2] text-[#17372d]">
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-xl font-bold">{error || "Supplier not found"}</h1>
          <Link
            href="/payments"
            className="mt-5 inline-block rounded-xl bg-[#0a6b48] px-5 py-3 text-sm font-bold text-white"
          >
            Back to payments
          </Link>
        </div>
      </main>
    );

  const { supplier, balance, deductions, payments, payoutsEnabled } = detail;
  const inFlight = payments.some((p) => p.status === "pending" || p.status === "timeout");
  const owes = balance.balance < 0;
  const canPay = payoutsEnabled && !inFlight && balance.payable >= balance.minAmount;
  const activeDeductions = deductions.filter((d) => !d.voided_at);

  return (
    <main className="min-h-screen bg-[#f4f7f2] text-[#17372d]">

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 md:px-12">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-[#0a6b48]">
          <Link href="/payments" className={`rounded-lg hover:underline ${focusRing}`}>
            Payments
          </Link>
          <span aria-hidden className="text-[#9aa89f]">/</span>
          <Link href={`/suppliers/${supplier.id}`} className={`rounded-lg hover:underline ${focusRing}`}>
            {supplier.full_name}
          </Link>
        </nav>

        <div className="mt-3">
          <p className={eyebrow}>Payments</p>
          <h1 className="mt-2 truncate text-2xl font-bold tracking-tight sm:text-3xl">{supplier.full_name}</h1>
          <p className="mt-1 text-sm font-semibold text-[#5a9960]">{supplier.supplier_code}</p>
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

        {/* Balance */}
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <div className="min-w-0 rounded-2xl border border-[#dce6dd] bg-white p-4 sm:p-5">
            <dt className="text-xs text-[#809087]">Earned</dt>
            <dd className="mt-1 truncate text-lg font-bold sm:text-xl">{money(balance.earned)}</dd>
          </div>
          <div className="min-w-0 rounded-2xl border border-[#dce6dd] bg-white p-4 sm:p-5">
            <dt className="text-xs text-[#809087]">Deductions</dt>
            <dd className="mt-1 truncate text-lg font-bold text-[#9a7440] sm:text-xl">
              {balance.deducted > 0 ? `−${money(balance.deducted)}` : money(0)}
            </dd>
          </div>
          <div className="min-w-0 rounded-2xl border border-[#dce6dd] bg-white p-4 sm:p-5">
            <dt className="text-xs text-[#809087]">Paid</dt>
            <dd className="mt-1 truncate text-lg font-bold sm:text-xl">{money(balance.paid)}</dd>
          </div>
          <div
            className={`min-w-0 rounded-2xl p-4 sm:p-5 ${owes ? "bg-red-700 text-white" : "bg-[#17372d] text-white"}`}
          >
            <dt className="text-xs text-[#b7cabd]">{owes ? "Owes SuperLeo" : "Balance due"}</dt>
            <dd className="mt-1 truncate text-lg font-bold sm:text-xl">{money(Math.abs(balance.balance))}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-[#809087]">
          Counts milk delivered from {balance.startDate ? formatDate(balance.startDate) : "the payments start date"}{" "}
          onward, at the rate locked on each delivery. Earlier milk is treated as already settled.
        </p>

        {/* Pay */}
        <div className={`${card} mt-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Pay by M-Pesa</h2>
              <p className="mt-1 text-sm text-[#71847a]">
                Sends money straight from SuperLeo&apos;s M-Pesa account to the supplier&apos;s phone.
              </p>
            </div>
          </div>

          {!payoutsEnabled ? (
            <p className="mt-4 rounded-xl border border-[#ecd3a8] bg-[#fdf4e3] px-4 py-3 text-sm text-[#8a5a12]">
              M-Pesa payments are switched off on the server. Set <code>MPESA_ENABLED=true</code> after
              configuring Daraja.
            </p>
          ) : inFlight ? (
            <p className="mt-4 rounded-xl border border-[#ecd3a8] bg-[#fdf4e3] px-4 py-3 text-sm text-[#8a5a12]">
              A payment to this supplier is still being processed. You can pay again once it finishes
              {payments.some((p) => p.status === "timeout")
                ? " or after you mark the payment that needs checking below."
                : "."}
            </p>
          ) : owes ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Deductions are more than what this supplier has earned, so there is nothing to pay. The
              difference carries forward and is taken off their next deliveries.
            </p>
          ) : !canPay ? (
            <p className="mt-4 rounded-xl border border-[#dce6dd] bg-[#f4f7f2] px-4 py-3 text-sm text-[#4f6a5b]">
              {balance.payable <= 0
                ? "Nothing is owed to this supplier right now."
                : `The balance is below the M-Pesa minimum of ${money(balance.minAmount)}.`}
            </p>
          ) : (
            <form onSubmit={pay} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Amount (KSh)
                <input
                  type="number"
                  min={balance.minAmount}
                  max={Math.min(balance.payable, balance.maxAmount)}
                  step="1"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className={field}
                />
                <span className="mt-1.5 block text-xs font-normal text-[#809087]">
                  Whole shillings. The full balance is {money(balance.payable)}
                  {balance.payable > balance.maxAmount ? `; M-Pesa sends up to ${money(balance.maxAmount)} at a time` : ""}.
                </span>
              </label>
              <label className="text-sm font-bold">
                M-Pesa number
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712 345 678"
                  required
                  className={field}
                />
                <span className="mt-1.5 block text-xs font-normal text-[#809087]">
                  {supplier.mpesa_phone
                    ? "Filled in from the supplier's profile. Change it if they use a different M-Pesa number."
                    : "The number on their profile is missing or not a Kenyan mobile number."}
                </span>
              </label>
              <label className="text-sm font-bold sm:col-span-2">
                Note (optional)
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. November milk"
                  className={field}
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={paying}
                  className={`rounded-xl bg-[#0a6b48] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#085a3d] disabled:opacity-60 ${focusRing}`}
                >
                  {paying ? "Sending..." : `Pay ${amount ? money(Math.floor(Number(amount)) || 0) : ""} via M-Pesa`}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Deductions */}
        <div className={`${card} mt-5`}>
          <h2 className="text-lg font-bold">Deductions</h2>
          <p className="mt-1 text-sm text-[#71847a]">
            Feed, advances or anything else taken off what this supplier is owed before you pay them.
          </p>

          <form onSubmit={addDeduction} className="mt-4 grid gap-3 sm:grid-cols-[.8fr_1.6fr_.9fr_.9fr_auto] sm:items-end">
            <label className="text-sm font-bold">
              Type
              <select name="kind" defaultValue="feed" className={field}>
                <option value="feed">Feed</option>
                <option value="advance">Advance</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="text-sm font-bold">
              Details
              <input name="description" maxLength={255} placeholder="e.g. 2 bags dairy meal" className={field} />
            </label>
            <label className="text-sm font-bold">
              Amount (KSh)
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                required
                className={field}
              />
            </label>
            <label className="text-sm font-bold">
              Date
              <input
                name="date"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className={field}
              />
            </label>
            <button
              type="submit"
              disabled={addingDeduction}
              className={`rounded-xl border border-[#c8d8cb] px-4 py-2.5 text-sm font-bold transition hover:border-[#5a9960] disabled:opacity-60 ${focusRing}`}
            >
              {addingDeduction ? "Adding..." : "Add"}
            </button>
          </form>

          {deductions.length ? (
            <ul className="mt-5 divide-y divide-[#edf2ed] border-t border-[#edf2ed]">
              {deductions.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className={`min-w-0 ${d.voided_at ? "opacity-50" : ""}`}>
                    <p className="text-sm font-bold">
                      {KIND_LABEL[d.kind]}
                      {d.description ? <span className="font-normal text-[#4f6a5b]"> · {d.description}</span> : null}
                      {d.voided_at && (
                        <span className="ml-2 rounded-full bg-[#eef2ec] px-2 py-0.5 text-[10px] font-bold uppercase text-[#71847a]">
                          Removed
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[#809087]">{formatDate(d.deduction_date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <strong className={`text-sm ${d.voided_at ? "text-[#9aa89f] line-through" : "text-[#9a7440]"}`}>
                      −{money(d.amount)}
                    </strong>
                    {!d.voided_at && (
                      <button
                        type="button"
                        onClick={() => voidDeduction(d)}
                        className={`rounded-lg px-2 py-1 text-sm font-bold text-red-700 transition hover:bg-red-50 ${focusRing}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-[#809087]">No deductions yet.</p>
          )}
          {activeDeductions.length > 0 && (
            <p className="mt-3 text-xs text-[#809087]">
              Total deducted: <strong className="text-[#17372d]">{money(balance.deducted)}</strong>
            </p>
          )}
        </div>

        {/* History */}
        <div className={`${card} mt-5 !p-0`}>
          <div className="p-5 pb-3 sm:p-6 sm:pb-3">
            <h2 className="text-lg font-bold">Payment history</h2>
          </div>
          {payments.length ? (
            <div className="overflow-x-auto border-t border-[#edf2ed]">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-[#f4f7f2] text-xs uppercase tracking-wider text-[#71847a]">
                  <tr>
                    <th className="px-5 py-3 font-bold">Date</th>
                    <th className="px-2 py-3 font-bold">Amount</th>
                    <th className="px-2 py-3 font-bold">Status</th>
                    <th className="px-2 py-3 font-bold">M-Pesa receipt</th>
                    <th className="px-5 py-3 text-right font-bold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const style = STATUS_STYLE[p.status];
                    return (
                      <tr key={p.id} className="border-t border-[#edf2ed] align-top">
                        <td className="whitespace-nowrap px-5 py-3">
                          <p>{formatDateTime(p.initiated_at)}</p>
                          <p className="text-xs text-[#809087]">to {p.phone}</p>
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 font-bold">{money(p.amount)}</td>
                        <td className="px-2 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${style.className}`}>
                            {style.label}
                          </span>
                          {(p.status === "failed" || p.status === "timeout") && p.result_desc && (
                            <p className="mt-1.5 max-w-xs text-xs text-[#71847a]">{p.result_desc}</p>
                          )}
                          {p.note && <p className="mt-1 text-xs text-[#809087]">{p.note}</p>}
                          {p.status === "completed" && p.receipt_emailed_at && (
                            <p className="mt-1 text-xs text-[#809087]">
                              Receipt emailed {formatDateTime(p.receipt_emailed_at)}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 font-mono text-xs">
                          {p.mpesa_receipt || "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          {p.status === "completed" && (
                            <button
                              type="button"
                              onClick={() => sendReceipt(p)}
                              className={`rounded-lg px-2 py-1 font-bold text-[#0a6b48] transition hover:bg-[#eef5e8] ${focusRing}`}
                            >
                              {p.receipt_emailed_at ? "Resend receipt" : "Email receipt"}
                            </button>
                          )}
                          {(p.status === "timeout" || p.status === "pending") && (
                            <>
                              <button
                                type="button"
                                onClick={() => resolve(p, "completed")}
                                className={`mr-1 rounded-lg px-2 py-1 font-bold text-[#0a6b48] transition hover:bg-[#eef5e8] ${focusRing}`}
                              >
                                Mark paid
                              </button>
                              <button
                                type="button"
                                onClick={() => resolve(p, "failed")}
                                className={`rounded-lg px-2 py-1 font-bold text-red-700 transition hover:bg-red-50 ${focusRing}`}
                              >
                                Mark failed
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="border-t border-[#edf2ed] px-5 py-10 text-center text-sm text-[#809087]">
              No payments yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
