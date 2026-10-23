import type { Metadata } from "next";
import { Header, EventNav, Footer } from "@/components/chrome";
import Assistant from "@/components/assistant";

export const metadata: Metadata = { title: "Community — Your AI assistant" };
export default function Page() {
  return (
    <div className="theme-community workspace-page">
      <Header kind="community" />
      <EventNav kind="community" active="assist" />
      <Assistant kind="community" />
      <Footer kind="community" />
    </div>
  );
}
