"use client";

import { useRef } from "react";
import type { EventKind } from "@/lib/events";

const sections = [
  { id: "overview", label: "The overview" },
  { id: "budget", label: "Your budget" },
  { id: "checklist", label: "The checklist" },
  { id: "vendors", label: "Your vendors" },
] as const;
export type OrganizerTab = (typeof sections)[number]["id"];

export default function OrganizerTabs({
  kind,
  selected,
  onSelect,
}: {
  kind: EventKind;
  selected: OrganizerTab;
  onSelect: (tab: OrganizerTab) => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      className="workspace-tabs"
      role="tablist"
      aria-label="Organizer sections"
    >
      {sections.map((section, index) => (
        <button
          key={section.id}
          ref={(button) => {
            buttons.current[index] = button;
          }}
          id={`${kind}-tab-${section.id}`}
          role="tab"
          aria-selected={selected === section.id}
          aria-controls={`${kind}-organizer-panel`}
          tabIndex={selected === section.id ? 0 : -1}
          className={selected === section.id ? "selected" : ""}
          onClick={() => onSelect(section.id)}
          onKeyDown={(event) => {
            let next: number;
            switch (event.key) {
              case "ArrowRight":
                next = (index + 1) % sections.length;
                break;
              case "ArrowLeft":
                next = (index + sections.length - 1) % sections.length;
                break;
              case "Home":
                next = 0;
                break;
              case "End":
                next = sections.length - 1;
                break;
              default:
                return;
            }
            event.preventDefault();
            onSelect(sections[next].id);
            buttons.current[next]?.focus();
          }}
        >
          {section.label}
        </button>
      ))}
    </div>
  );
}
