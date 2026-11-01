import "@fontsource-variable/inter";
import type { Metadata } from "next";
import { HEAD_INIT_SCRIPT } from "@/lib/init-scripts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Yuzu", template: "%s – Yuzu" },
  description: "Klantenservice voor jullie webshops, met AI.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: de scripts hieronder zetten data-theme en data-views vóór React start.
    <html lang="nl" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: HEAD_INIT_SCRIPT,
          }}
        />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
