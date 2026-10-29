import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yuzu",
  description: "Klantenservice voor jullie webshops, met AI.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
