import type { Metadata } from "next";
import { Header, EventNav, Footer } from "@/components/chrome";
import Organizer from "@/components/organizer";

export const metadata: Metadata = { title: "Birthday — Your organizer" };
export default function Page() {
  return (
    <div className="theme-birthday workspace-page">
      <Header kind="birthday" />
      <EventNav kind="birthday" active="organize" />
      <Organizer kind="birthday" />
      <Footer kind="birthday" />
    </div>
  );
}
