"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TOKEN_KEY } from "../lib/manager-api";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a6b48]";
const navLink = `rounded-full px-3 py-1.5 text-sm font-bold transition ${focusRing}`;

export function ManagerHeader({
  active,
}: {
  active: "overview" | "suppliers";
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    router.replace("/");
  }

  const links = [
    { id: "overview", href: "/dashboard", label: "Overview" },
    { id: "suppliers", href: "/suppliers", label: "Suppliers" },
  ] as const;

  return (
    <header className="sticky top-0 z-20 border-b border-[#dce6dd] bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 md:h-20 md:px-12">
        <a
          href="/dashboard"
          aria-label="SuperLeo manager home"
          className={`flex min-w-0 items-center rounded-lg ${focusRing}`}
        >
          {/* logo.png lives in your app's /public folder */}
          <img
            src="/logo.png"
            alt="SuperLeo"
            className="h-8 w-auto shrink-0 sm:h-10"
          />
        </a>

        <div className="hidden items-center gap-3 md:flex">
          <nav aria-label="Main" className="flex items-center gap-1">
            {links.map((link) => (
              <a
                key={link.id}
                href={link.href}
                aria-current={active === link.id ? "page" : undefined}
                className={`${navLink} ${
                  active === link.id
                    ? "bg-[#dceccd] text-[#0a6b48]"
                    : "text-[#64766b] hover:bg-[#eef5e8] hover:text-[#0a6b48]"
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <button
            type="button"
            onClick={logout}
            className={`rounded-full border border-[#c8d8cb] px-4 py-1.5 text-sm font-bold text-[#17372d] transition hover:bg-[#17372d] hover:text-white ${focusRing}`}
          >
            Log out
          </button>
        </div>

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
            {links.map((link) => (
              <a
                key={link.id}
                href={link.href}
                aria-current={active === link.id ? "page" : undefined}
                className={`rounded-xl px-3 py-3 ${
                  active === link.id
                    ? "bg-[#dceccd] text-[#0a6b48]"
                    : "text-[#17372d] hover:bg-[#f2f7f0]"
                }`}
              >
                {link.label}
              </a>
            ))}
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
  );
}
