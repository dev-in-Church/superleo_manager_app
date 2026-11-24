"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Option = {
  id: string;
  full_name: string;
  supplier_code: string;
  is_active?: boolean | null;
};

type Props = {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  label?: string; // accessible name
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
};

type Position = { left: number; width: number; top?: number; bottom?: number };

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a6b48]";

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#dceccd] text-xs font-bold uppercase text-[#0a6b48]"
    >
      {name.charAt(0)}
    </span>
  );
}

/** A searchable supplier picker: type to filter, arrow keys + Enter to choose, Esc to close. */
export function SupplierSelect({
  options,
  value,
  onChange,
  placeholder = "Choose a supplier",
  label = "Supplier",
  loading = false,
  disabled = false,
  required = false,
}: Props) {
  const uid = useId();
  const listId = `${uid}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((option) => option.id === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.full_name.toLowerCase().includes(q) ||
        option.supplier_code.toLowerCase().includes(q),
    );
  }, [options, query]);

  // Place the panel under the field (or above it when there is no room), outside any clipping parent
  function measure() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom;
    const above = below < 330 && rect.top > below;
    setPosition(
      above
        ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 8 }
        : { left: rect.left, width: rect.width, top: rect.bottom + 8 },
    );
  }

  function close(returnFocus = false) {
    setOpen(false);
    setQuery("");
    if (returnFocus) triggerRef.current?.focus();
  }

  function pick(option: Option) {
    onChange(option.id);
    close(true);
  }

  function openPanel() {
    if (disabled || loading) return;
    measure();
    setActive(Math.max(0, options.findIndex((option) => option.id === value)));
    setOpen(true);
  }

  // Focus the search box when the panel opens
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Back to the top of the results as you type
  useEffect(() => {
    if (query) setActive(0);
  }, [query]);

  // Keep the highlighted row visible while using the arrow keys
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // Close on outside click; follow the field when the page scrolls or resizes
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) close();
    };
    const onMove = () => measure();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[active]) pick(filtered[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      close();
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        disabled={disabled}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            openPanel();
          }
        }}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 py-2.5 text-left text-sm outline-none transition hover:border-[#5a9960] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${
          open ? "border-[#5a9960] ring-2 ring-[#5a9960]/20" : "border-[#dce6dd]"
        }`}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-3">
            <Avatar name={selected.full_name} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{selected.full_name}</span>
              <span className="block text-xs font-semibold text-[#5a9960]">{selected.supplier_code}</span>
            </span>
          </span>
        ) : (
          <span className="text-[#9aa89f]">{loading ? "Loading suppliers..." : placeholder}</span>
        )}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`size-4 shrink-0 text-[#71847a] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Lets the browser's own "required" check work with this custom control */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => {}}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      )}

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              left: position.left,
              width: position.width,
              top: position.top,
              bottom: position.bottom,
            }}
            className="z-50 overflow-hidden rounded-xl border border-[#dce6dd] bg-white shadow-xl shadow-[#17372d]/10"
          >
            <div className="flex items-center gap-2 border-b border-[#edf2ed] px-3">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="size-4 shrink-0 text-[#809087]"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                role="searchbox"
                aria-label="Search suppliers"
                aria-controls={listId}
                aria-activedescendant={filtered[active] ? `${uid}-opt-${filtered[active].id}` : undefined}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search name or code"
                className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-[#9aa89f]"
              />
            </div>

            <ul ref={listRef} id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto py-1">
              {filtered.map((option, index) => {
                const isSelected = option.id === value;
                return (
                  <li
                    key={option.id}
                    id={`${uid}-opt-${option.id}`}
                    role="option"
                    aria-selected={isSelected}
                    data-index={index}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(event) => event.preventDefault()} // keep focus in the search box
                    onClick={() => pick(option)}
                    className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${
                      index === active ? "bg-[#f2f7f0]" : ""
                    }`}
                  >
                    <Avatar name={option.full_name} />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm ${isSelected ? "font-bold text-[#0a6b48]" : "font-semibold"} ${
                          option.is_active === false ? "text-[#809087]" : ""
                        }`}
                      >
                        {option.full_name}
                      </span>
                      <span className="block text-xs font-semibold text-[#5a9960]">{option.supplier_code}</span>
                    </span>
                    {option.is_active === false && (
                      <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                        Inactive
                      </span>
                    )}
                    {isSelected && (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-4 shrink-0 text-[#0a6b48]"
                        aria-hidden
                      >
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                    )}
                  </li>
                );
              })}
              {!filtered.length && (
                <li role="presentation" className="px-4 py-6 text-center text-sm text-[#809087]">
                  {options.length ? `No suppliers match “${query}”.` : "No suppliers yet."}
                </li>
              )}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
