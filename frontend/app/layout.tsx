import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { MotionProvider } from "@/components/motion";
import "./globals.css";

const sans = localFont({
  src: [
    { path: "../public/fonts/dm-regular.ttf", weight: "400" },
    { path: "../public/fonts/dm-medium.ttf", weight: "500" },
    { path: "../public/fonts/dm-semibold.ttf", weight: "600" },
    { path: "../public/fonts/dm-bold.ttf", weight: "700" },
  ],
  variable: "--font-dm-sans",
  display: "swap",
});
const serif = localFont({
  src: [
    {
      path: "../public/fonts/instrument-regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/instrument-italic.ttf",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Mehfiloom — Good times begin here.",
    template: "%s | Mehfiloom",
  },
  description:
    "A thoughtful planning companion for weddings, birthdays, and community gatherings. Bring your ideas, budget, timeline, and people together.",
};
export const viewport: Viewport = {
  themeColor: "#f4f0e8",
  width: "device-width",
  initialScale: 1,
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body id="top">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
