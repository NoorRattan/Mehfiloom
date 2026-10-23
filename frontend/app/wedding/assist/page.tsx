import type { Metadata } from "next";
import { Header, EventNav, Footer } from "@/components/chrome";
import Assistant from "@/components/assistant";

export const metadata: Metadata = { title: "Wedding — Your AI assistant" };
export default function Page() {
  return (
    <div className="theme-wedding workspace-page">
      <Header kind="wedding" />
      <EventNav kind="wedding" active="assist" />
      <Assistant kind="wedding" />
      <Footer kind="wedding" />
    </div>
  );
}
