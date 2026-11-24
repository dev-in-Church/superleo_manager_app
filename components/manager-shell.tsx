"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TOKEN_KEY } from "../lib/manager-api";

const COLLAPSE_KEY = "superleo_manager_sidebar_collapsed";
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a6b48]";

/* ---------- icons (inline, no icon library needed) ---------- */
const ICONS: Record<string, ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  suppliers: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  payments: (
    <>
      <path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" />
      <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </>
  ),
  reports: (
    <>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </>
  ),
  record: (
    <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
  ),
  price: (
    <>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  collapse: (
    <>
      <path d="m11 17-5-5 5-5" />
      <path d="m18 17-5-5 5-5" />
    </>
  ),
  expand: (
    <>
      <path d="m13 17 5-5-5-5" />
      <path d="m6 17 5-5-5-5" />
    </>
  ),
};

function NavIcon({ name, className = "size-5" }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

/* ---------- navigation ---------- */
// A supplier's payments page lives under /suppliers/<id>/payments, but it belongs to "Payments".
const isPaymentsRoute = (p: string) => p === "/payments" || (p.startsWith("/suppliers/") && p.endsWith("/payments"));

const MAIN_NAV = [
  { href: "/dashboard", label: "Overview", icon: "overview", match: (p: string) => p.startsWith("/dashboard") },
  {
    href: "/suppliers",
    label: "Suppliers",
    icon: "suppliers",
    match: (p: string) => p.startsWith("/suppliers") && !isPaymentsRoute(p),
  },
  { href: "/payments", label: "Payments", icon: "payments", match: isPaymentsRoute },
  { href: "/reports", label: "Reports", icon: "reports", match: (p: string) => p.startsWith("/reports") },
];

// Jump straight to a section of the overview page
const SHORTCUTS = [
  { href: "/dashboard#workspace", label: "Record milk", icon: "record" },
  { href: "/dashboard#pricing", label: "Default price", icon: "price" },
];

function NavItem({
  href,
  label,
  icon,
  active = false,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: string;
  active?: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        title={collapsed ? label : undefined}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${focusRing} ${
          collapsed ? "justify-center" : ""
        } ${
          active
            ? "bg-[#dceccd] text-[#0a6b48]"
            : "text-[#4f6a5b] hover:bg-[#f2f7f0] hover:text-[#0a6b48]"
        }`}
      >
        <NavIcon name={icon} className="size-5 shrink-0" />
        {collapsed ? <span className="sr-only">{label}</span> : <span className="truncate">{label}</span>}
      </Link>
    </li>
  );
}

function SidebarContent({
  collapsed,
  pathname,
  onNavigate,
  onLogout,
  onToggleCollapse,
}: {
  collapsed: boolean;
  pathname: string;
  onNavigate: () => void;
  onLogout: () => void;
  onToggleCollapse?: () => void;
}) {
  const sectionLabel = "px-3 pb-2 text-[11px] font-bold uppercase tracking-[.14em] text-[#9aa89f]";
  return (
    <>
      <div
        className={`flex h-16 shrink-0 items-center border-b border-[#edf2ed] ${collapsed ? "justify-center" : "px-5"}`}
      >
        <Link
          href="/dashboard"
          onClick={onNavigate}
          aria-label="SuperLeo Manager home"
          className={`rounded-lg ${focusRing}`}
        >
          {collapsed ? (
            // only the lion emblem from the logo (the left part of the image)
            <span className="block h-8 w-9 overflow-hidden">
              {/* logo.png lives in your app's /public folder */}
              <img src="/logo.png" alt="SuperLeo" className="h-8 w-auto max-w-none" />
            </span>
          ) : (
            <img src="/logo.png" alt="SuperLeo" className="h-8 w-auto" />
          )}
        </Link>
      </div>

      <nav aria-label="Manager" className="flex-1 overflow-y-auto px-3 py-5">
        {!collapsed && <p className={sectionLabel}>Workspace</p>}
        <ul className="flex flex-col gap-1">
          {MAIN_NAV.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={item.match(pathname)}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </ul>

        <div className={collapsed ? "mt-4 border-t border-[#edf2ed] pt-4" : "mt-6"}>
          {!collapsed && <p className={sectionLabel}>Shortcuts</p>}
          <ul className="flex flex-col gap-1">
            {SHORTCUTS.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      </nav>

      <div className="shrink-0 border-t border-[#edf2ed] p-3">
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : undefined}
            className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#71847a] transition hover:bg-[#f2f7f0] hover:text-[#0a6b48] ${focusRing} ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <NavIcon name={collapsed ? "expand" : "collapse"} className="size-5 shrink-0" />
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? "Log out" : undefined}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 ${focusRing} ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <NavIcon name="logout" className="size-5 shrink-0" />
          {collapsed ? <span className="sr-only">Log out</span> : <span>Log out</span>}
        </button>
      </div>
    </>
  );
}

/* ---------- the shell ---------- */
export function ManagerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false); // mobile drawer

  // The login page and the offline page get no sidebar
  const bare = pathname === "/" || pathname === "/offline";

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Close the drawer when you navigate
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Drawer: Escape closes it, and the page behind it doesn't scroll
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  function toggleCollapse() {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !value;
    });
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    router.replace("/");
  }

  if (bare) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#f4f7f2]">
      {/* Phones and tablets: top bar with a menu button */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#dce6dd] bg-white/90 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard" aria-label="SuperLeo Manager home" className={`rounded-lg ${focusRing}`}>
          <img src="/logo.png" alt="SuperLeo" className="h-7 w-auto" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="manager-drawer"
          className={`-mr-2 flex size-10 items-center justify-center rounded-xl text-[#17372d] transition hover:bg-[#eef5e8] ${focusRing}`}
        >
          <NavIcon name="menu" className="size-6" />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-[#dce6dd] bg-white transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[76px]" : "w-64"
        }`}
      >
        <SidebarContent
          collapsed={collapsed}
          pathname={pathname}
          onNavigate={() => {}}
          onLogout={logout}
          onToggleCollapse={toggleCollapse}
        />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu" id="manager-drawer">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[#17372d]/40"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className={`absolute right-3 top-3 flex size-9 items-center justify-center rounded-xl text-[#4f6a5b] transition hover:bg-[#f2f7f0] ${focusRing}`}
            >
              <NavIcon name="close" className="size-5" />
            </button>
            <SidebarContent
              collapsed={false}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
              onLogout={logout}
            />
          </aside>
        </div>
      )}

      {/* Page content */}
      <div className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-[76px]" : "lg:pl-64"}`}>
        {children}
      </div>
    </div>
  );
}
