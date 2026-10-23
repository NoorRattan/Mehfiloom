import type { Metadata } from "next";
import { Header, EventNav, Footer } from "@/components/chrome";
import Organizer from "@/components/organizer";

export const metadata: Metadata = { title: "Community — Your organizer" };
export default function Page() {
  return (
    <div className="theme-community workspace-page">
      <Header kind="community" />
      <EventNav kind="community" active="organize" />
      <Organizer kind="community" />
      <Footer kind="community" />
    </div>
  );
}
