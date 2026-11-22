import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { RegisterServiceWorker } from "../components/pwa";
import { ManagerShell } from "../components/manager-shell";

export const metadata: Metadata = {
  title: "SuperLeo Manager",
  description: "Dairy operations management",
  applicationName: "SuperLeo Manager",
  appleWebApp: {
    capable: true,
    title: "SuperLeo Manager",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ManagerShell>{children}</ManagerShell>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
