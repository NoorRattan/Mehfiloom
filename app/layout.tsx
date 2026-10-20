import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mehfiloom — Weave your perfect celebration",
  description:
    "A thoughtful planning canvas for weddings, birthdays, and community celebrations.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
