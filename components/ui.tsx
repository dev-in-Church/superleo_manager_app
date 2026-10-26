"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline";
};
export function Button({
  className = "",
  variant = "default",
  ...props
}: ButtonProps) {
  const variantClass =
    variant === "outline"
      ? "border border-[#648b6f] bg-transparent text-current hover:bg-black/5"
      : "bg-[#0a6b48] text-white hover:bg-[#07543a]";
  return (
    <button
      className={`rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClass} ${className}`}
      {...props}
    />
  );
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-xl border border-[#dce6dd] bg-white px-4 py-3 text-[#17372d] outline-none transition placeholder:text-[#9aaa9e] focus:border-[#0a6b48] focus:ring-4 focus:ring-[#0a6b48]/10"
      {...props}
    />
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-2xl border border-[#dce6dd] bg-white p-6 shadow-sm ${className}`}
    >
      {children}
    </article>
  );
}
