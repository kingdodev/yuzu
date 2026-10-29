import "@fontsource-variable/instrument-sans";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Yuzu", template: "%s – Yuzu" },
  description: "Klantenservice voor jullie webshops, met AI.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
