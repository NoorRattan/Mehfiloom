import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./premium.css";

export const metadata: Metadata = {
  title: "Mehfiloom — plan a wedding, birthday, or community event",
  description:
    "A planning assistant that helps you turn a celebration idea into a practical budget, timeline, checklists, and personal touches.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
