import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { AppProviders } from "@/components/common/AppProviders";

export const metadata: Metadata = {
  title: "Z-Ray – Private Zcash Explorer",
  description:
    "Z-Ray is a privacy-first Zcash explorer where shielded transactions are decrypted locally in your browser using a WASM-based light client.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
