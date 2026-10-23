import type { Metadata } from "next";
import { Header, EventNav, Footer } from "@/components/chrome";
import Organizer from "@/components/organizer";

export const metadata: Metadata = { title: "Wedding — Your organizer" };
export default function Page() {
  return (
    <div className="theme-wedding workspace-page">
      <Header kind="wedding" />
      <EventNav kind="wedding" active="organize" />
      <Organizer kind="wedding" />
      <Footer kind="wedding" />
    </div>
  );
}
