"use client";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7f2] px-6 text-[#17372d]">
      <div className="max-w-sm rounded-3xl border border-[#dce6dd] bg-white p-8 text-center shadow-sm">
        <img src="/icons/icon-192.png" alt="" className="mx-auto size-16 rounded-2xl" />
        <h1 className="mt-5 text-2xl font-bold">You&apos;re offline</h1>
        <p className="mt-2 text-sm leading-6 text-[#71847a]">
          SuperLeo Manager needs an internet connection to load suppliers and
          milk records. Check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-xl bg-[#0a6b48] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#085a3d]"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
