import { notFound, redirect } from "next/navigation";
import { eventKinds, type EventKind } from "@/lib/events";

export default async function LegacyPlanner({
  params,
}: {
  params: Promise<{ eventType: string }>;
}) {
  const { eventType } = await params;
  if (!eventKinds.includes(eventType as EventKind)) notFound();
  redirect(`/${eventType}/organize`);
}
