import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PlannerWorkspace from "@/components/PlannerWorkspace";
import { EVENT_TYPES, type EventType } from "@/lib/planner";

const labels: Record<EventType, string> = { wedding: "Wedding", birthday: "Birthday", community: "Community event" };

export function generateStaticParams() {
  return EVENT_TYPES.map((eventType) => ({ eventType }));
}

export const instant = false;

export async function generateMetadata({ params }: { params: Promise<{ eventType: string }> }): Promise<Metadata> {
  const { eventType } = await params;
  if (!EVENT_TYPES.includes(eventType as EventType)) return { title: "Plan your event | Mehfiloom" };
  return { title: `${labels[eventType as EventType]} plan | Mehfiloom` };
}

export default async function PlannerPage({ params }: { params: Promise<{ eventType: string }> }) {
  const { eventType } = await params;
  if (!EVENT_TYPES.includes(eventType as EventType)) notFound();
  return <PlannerWorkspace key={eventType} initialEventType={eventType as EventType} />;
}
