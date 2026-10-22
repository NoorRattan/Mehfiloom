import { EVENT_TYPES, type EventType } from "@/lib/planner";

const EVENT_LABELS: Record<EventType, string> = {
  wedding: "Wedding",
  birthday: "Birthday",
  community: "Community event",
};

const EVENT_MARKS: Record<EventType, string> = {
  wedding: "W",
  birthday: "B",
  community: "C",
};

type EventTypeSelectorProps = {
  value: EventType;
  hasError: boolean;
  onChange: (eventType: EventType) => void;
};

export function EventTypeSelector({ value, hasError, onChange }: EventTypeSelectorProps) {
  return (
    <fieldset
      className="event-type-fieldset"
      id="event-type-options"
      tabIndex={-1}
      aria-describedby={hasError ? "brief-error" : undefined}
    >
      <legend>What are you planning?</legend>
      <div className="event-type-grid">
        {EVENT_TYPES.map((type) => (
          <button
            type="button"
            key={type}
            className={`event-type-option ${value === type ? "selected" : ""}`}
            aria-pressed={value === type}
            onClick={() => onChange(type)}
          >
            <span className={`event-type-mark mark-${type}`}>{EVENT_MARKS[type]}</span>
            <span>{EVENT_LABELS[type]}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
