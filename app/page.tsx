"use client";

import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "../components/ui";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
type LoginResponse = {
  data?: { token: string; user: { role: string } };
  error?: string;
};

function PasswordField() {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold">
        Password
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          placeholder="Your password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-[#dce6dd] bg-white py-3 pl-4 pr-12 outline-none transition focus:border-[#5a9960]"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-[#71847a] transition hover:text-[#0a6b48] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0a6b48]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
            aria-hidden
          >
            {visible ? (
              <>
                {/* eye with a line through it: click to hide */}
                <path d="M9.9 4.2A10 10 0 0 1 12 4c6.4 0 10 8 10 8a17 17 0 0 1-2.9 3.9" />
                <path d="M6.6 6.6A17 17 0 0 0 2 12s3.6 8 10 8a9.8 9.8 0 0 0 5.4-1.6" />
                <path d="M14.1 14.1a3 3 0 0 1-4.2-4.2" />
                <path d="m2 2 20 20" />
              </>
            ) : (
              <>
                {/* open eye: click to show */}
                <path d="M2 12s3.6-8 10-8 10 8 10 8-3.6 8-10 8S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const payload = Object.fromEntries(
        new FormData(event.currentTarget).entries(),
      );
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json()) as LoginResponse;
      if (!response.ok || !json.data)
        throw new Error(json.error || "Unable to log in");
      if (!["manager", "admin"].includes(json.data.user.role))
        throw new Error("Manager or admin access is required.");
      localStorage.setItem("superleo_manager_token", json.data.token);
      router.push("/dashboard");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to log in",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-[#edf4ed] p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl border border-[#dce6dd] bg-white p-8 shadow-xl shadow-[#17372d]/10"
      >
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#5a9960]">
          SuperLeo operations
        </p>
        <h1 className="mt-4 text-4xl font-bold">Manager sign in</h1>
        <p className="mt-3 leading-7 text-[#71847a]">
          Access the dairy collection centre workspace.
        </p>
        <div className="mt-8 flex flex-col gap-4">
          <label className="text-sm font-bold">
            Email
            <Input
              name="email"
              type="email"
              placeholder="manager@superleo.local"
              autoComplete="email"
              required
            />
          </label>
          <PasswordField />
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Signing in..." : "Sign in to dashboard"}
          </Button>
        </div>
      </form>
    </main>
  );
}
