import { useEffect, useState } from "react";

export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
export const TOKEN_KEY = "superleo_manager_token";

export async function request<T>(
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
  if (!response.ok) {
    let message = "Request failed";
    try {
      message = (await response.json()).error || message;
    } catch {
      /* response had no JSON body */
    }
    throw new Error(message);
  }
  return response.json();
}

/** undefined = still checking, null = not logged in, string = token.
 *  Read after mount, so server and browser render the same thing first. */
export function useManagerToken() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
  }, []);
  return token;
}

export function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ---------- types ---------- */
export type SupplierRow = {
  id: string;
  supplier_code: string;
  full_name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  is_active?: boolean | null;
  created_at?: string;
  records_count: number;
  total_litres: string | number;
};
export type Delivery = {
  id: string;
  quantity_litres: number | string;
  session_date: string;
  session_type: string;
  full_name?: string;
  supplier_code?: string;
};

/* ---------- formatting ---------- */
export function formatDate(value: string) {
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
export const litres = (n: number | string) =>
  `${Math.round(Number(n) * 10) / 10} L`;
export const money = (n: number | string) =>
  `KSh ${Number(n).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
export const isActive = (s: { is_active?: boolean | null }) =>
  s.is_active !== false;
