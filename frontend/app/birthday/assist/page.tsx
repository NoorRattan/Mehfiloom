import type { Metadata } from "next";
import { Header, EventNav, Footer } from "@/components/chrome";
import Assistant from "@/components/assistant";

export const metadata: Metadata = { title: "Birthday — Your AI assistant" };
export default function Page() {
  return (
    <div className="theme-birthday workspace-page">
      <Header kind="birthday" />
      <EventNav kind="birthday" active="assist" />
      <Assistant kind="birthday" />
      <Footer kind="birthday" />
    </div>
  );
}
