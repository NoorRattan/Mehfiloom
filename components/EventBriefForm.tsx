import {
  ArrowRight,
  CalendarDays,
  CircleAlert,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  UsersRound,
  WandSparkles,
} from "lucide-react";
import { useEffect, useRef, type FormEvent } from "react";
import type { EventBrief } from "@/lib/planner";
import { makeId } from "@/lib/plan-store";
import type { ZonedDateTimeResolution } from "@/lib/schedule";
import { EventTypeSelector } from "./EventTypeSelector";

const EVENT_STYLE_PROMPTS: Record<EventBrief["eventType"], { label: string; placeholder: string; mustHaves: string }> = {
  wedding: {
    label: "What should it feel like?",
    placeholder: "A relaxed garden celebration with traditions we choose together…",
    mustHaves: "Accessibility, dietary needs, traditions you have chosen, and a weather backup…",
  },
  birthday: {
    label: "Who is the day for, and what do they enjoy?",
    placeholder: "A hands-on activity party, with a quieter spot to take a break…",
    mustHaves: "Food allergies to confirm with parents, clear routes, supervision, or a quieter space…",
  },
  community: {
    label: "What is the purpose and feel of the gathering?",
    placeholder: "A neighbor-led evening to share food, stories, and local ideas…",
    mustHaves: "Step-free routes, language access, volunteer roles, sanitation, and a weather backup…",
  },
};

type EventBriefFormProps = {
  brief: EventBrief;
  eventTimeResolution: ZonedDateTimeResolution;
  eventTimeDisplay: string | null;
  sessionTimeResolutions: Map<string, ZonedDateTimeResolution>;
  errorTargetId: string | null;
  error: string;
  generationAnnouncement: string;
  generating: boolean;
  hasPendingRevision: boolean;
  isRevision: boolean;
  revisionRequest: string;
  onRevisionRequestChange: (value: string) => void;
  onLoadExample: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateBrief: <K extends keyof EventBrief>(field: K, value: EventBrief[K]) => void;
};

function formatZonedInstant(instant: string | null, timeZone: string | null): string | null {
  if (!instant || !timeZone) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(instant));
  } catch {
    return null;
  }
}

export function EventBriefForm({
  brief,
  eventTimeResolution,
  eventTimeDisplay,
  sessionTimeResolutions,
  errorTargetId,
  error,
  generationAnnouncement,
  generating,
  hasPendingRevision,
  isRevision,
  revisionRequest,
  onRevisionRequestChange,
  onLoadExample,
  onSubmit,
  onUpdateBrief,
}: EventBriefFormProps) {
  const sessionNameInputs = useRef(new Map<string, HTMLInputElement>());
  const addSessionButton = useRef<HTMLButtonElement>(null);
  const focusAfterSessionRemoval = useRef<string | "add-session" | null>(null);

  useEffect(() => {
    const target = focusAfterSessionRemoval.current;
    if (!target) return;

    if (target === "add-session") {
      addSessionButton.current?.focus();
    } else {
      sessionNameInputs.current.get(target)?.focus();
    }
    focusAfterSessionRemoval.current = null;
  }, [brief.sessions]);

  function removeSession(sessionId: string, index: number) {
    const nextSessions = brief.sessions.filter((item) => item.id !== sessionId);
    const focusSession = nextSessions[Math.min(index, nextSessions.length - 1)];
    focusAfterSessionRemoval.current = focusSession?.id ?? "add-session";
    onUpdateBrief("sessions", nextSessions);
  }

  return (
    <aside className="brief-card">
      <div className="card-kicker"><span className="step-number">01</span> YOUR EVENT BRIEF</div>
      <div className="brief-heading-row">
        <div><h2>Start with the feeling.</h2><p className="card-intro">A few details help us make the ideas personal and practical.</p></div>
        <button className="text-button" type="button" onClick={onLoadExample} title="Restore the clearly labeled example brief"><WandSparkles size={15} /> Use example</button>
      </div>
      <form onSubmit={onSubmit} noValidate>
        <EventTypeSelector value={brief.eventType} hasError={errorTargetId === "event-type-options"} onChange={(eventType) => onUpdateBrief("eventType", eventType)} />
        <div className="form-grid">
          <label className="field field-full"><span>Event name</span><input id="event-name" value={brief.eventName} onChange={(event) => onUpdateBrief("eventName", event.target.value)} maxLength={80} required aria-invalid={errorTargetId === "event-name" || undefined} aria-describedby={errorTargetId === "event-name" ? "brief-error" : undefined} /></label>
          <label className="field"><span>Where</span><span className="input-with-icon"><MapPin size={16} /><input id="event-location" value={brief.location} onChange={(event) => onUpdateBrief("location", event.target.value)} maxLength={100} required aria-invalid={errorTargetId === "event-location" || undefined} aria-describedby={errorTargetId === "event-location" ? "brief-error" : undefined} /></span></label>
          <label className="field"><span>Event date <small>optional</small></span><span className="input-with-icon"><CalendarDays size={16} /><input id="event-date" type="date" value={brief.eventDate} onInput={(event) => onUpdateBrief("eventDate", event.currentTarget.value)} aria-invalid={errorTargetId === "event-date" || undefined} aria-describedby={errorTargetId === "event-date" ? "brief-error" : undefined} /></span></label>
          <label className="field"><span>Event time zone <small>optional until time is known</small></span><input id="event-timezone" list="iana-time-zones" value={brief.timeZone ?? ""} onChange={(event) => onUpdateBrief("timeZone", event.target.value.trim() || null)} placeholder="Asia/Kolkata" aria-invalid={errorTargetId === "event-timezone" || undefined} aria-describedby={errorTargetId === "event-timezone" ? "timezone-help brief-error" : "timezone-help"} /><small id="timezone-help" className="field-hint">Use an IANA name. Calendar dates stay as entered; local times use this zone, never the computer’s time zone.</small></label>
          <div className="field"><label htmlFor="event-time"><span>Local event start time <small>optional</small></span><input id="event-time" type="text" inputMode="numeric" maxLength={5} value={brief.eventTime} onChange={(event) => onUpdateBrief("eventTime", event.currentTarget.value)} placeholder="e.g. 18:30" aria-invalid={errorTargetId === "event-time" || undefined} aria-describedby={errorTargetId === "event-time" ? "event-time-help brief-error" : "event-time-help"} /></label>
            {eventTimeResolution.status === "ambiguous" && <label className="time-occurrence-choice">This time occurs twice<select aria-label="Choose which repeated event time" value={brief.eventTimeOccurrence ?? ""} onChange={(event) => onUpdateBrief("eventTimeOccurrence", event.target.value === "" ? null : event.target.value as "earlier" | "later")}><option value="">Choose occurrence</option><option value="earlier">Earlier occurrence</option><option value="later">Later occurrence</option></select></label>}
            <small id="event-time-help" className="field-hint">{eventTimeDisplay ? `Resolves to ${eventTimeDisplay}.` : eventTimeResolution.status === "nonexistent" ? "This local time does not exist because clocks move forward." : eventTimeResolution.status === "ambiguous" ? "Choose the earlier or later occurrence of this repeated local time." : brief.eventTime ? "Set the date and IANA time zone to resolve this local time." : "Enter a local time only when you know the event’s time zone."}</small>
          </div>
          <datalist id="iana-time-zones">{["UTC", "Asia/Kolkata", "Asia/Dubai", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Australia/Sydney"].map((zone) => <option key={zone} value={zone} />)}</datalist>
          <label className="field"><span>Unique guests across the event</span><span className="input-with-icon"><UsersRound size={16} /><input id="guest-count" type="number" min={1} max={10000} step={1} value={brief.guestCount} onChange={(event) => onUpdateBrief("guestCount", Number(event.target.value))} required aria-invalid={errorTargetId === "guest-count" || undefined} aria-describedby={errorTargetId === "guest-count" ? "brief-error" : undefined} /></span><small className="field-hint">An overall estimate. People may attend more than one session, so these counts are not added together.</small></label>
          <div className="field-full session-builder" role="group" aria-labelledby="session-builder-title">
            <div className="session-builder-heading"><span id="session-builder-title" tabIndex={errorTargetId === "session-builder-title" ? -1 : undefined} aria-describedby={errorTargetId === "session-builder-title" ? "brief-error" : undefined}>Functions or sessions <small>optional</small></span><button ref={addSessionButton} className="text-button" type="button" disabled={brief.sessions.length >= 12} onClick={() => onUpdateBrief("sessions", [...brief.sessions, { id: makeId(), name: `Session ${brief.sessions.length + 1}`, date: "", startTime: "", startTimeOccurrence: null, guestCount: brief.guestCount }])}><Plus size={14} /> Add a session</button></div>
            <p className="field-hint">Use this for separate wedding functions, birthday activities, or community-event time blocks. Enter only the guests expected at each one. Each local start time uses the event time zone above.</p>
            {brief.sessions.map((session, index) => {
              const sessionTimeResolution = sessionTimeResolutions.get(session.id);
              const sessionTimeDisplay = formatZonedInstant(sessionTimeResolution?.instant ?? null, brief.timeZone);
              return (
                <div className="session-row" key={session.id}>
                  <label>Session name<input ref={(element) => { if (element) sessionNameInputs.current.set(session.id, element); else sessionNameInputs.current.delete(session.id); }} id={`session-${session.id}-name`} aria-label={`Session ${index + 1} name`} value={session.name} onChange={(event) => onUpdateBrief("sessions", brief.sessions.map((item) => item.id === session.id ? { ...item, name: event.target.value } : item))} maxLength={80} placeholder={`Session ${index + 1}`} required aria-invalid={errorTargetId === `session-${session.id}-name` || undefined} aria-describedby={errorTargetId === `session-${session.id}-name` ? "brief-error" : undefined} /></label>
                  <div className="session-date-time">
                    <label>Date <small>optional</small><input id={`session-${session.id}-date`} aria-label={`Session ${index + 1} date`} type="date" value={session.date} onInput={(event) => onUpdateBrief("sessions", brief.sessions.map((item) => item.id === session.id ? { ...item, date: event.currentTarget.value, startTimeOccurrence: null } : item))} aria-invalid={errorTargetId === `session-${session.id}-date` || undefined} aria-describedby={errorTargetId === `session-${session.id}-date` ? "brief-error" : undefined} /></label>
                    <label>Local start time <small>optional</small><input id={`session-${session.id}-time`} aria-label={`Session ${index + 1} local start time`} type="text" inputMode="numeric" maxLength={5} placeholder="e.g. 18:30" value={session.startTime} onChange={(event) => onUpdateBrief("sessions", brief.sessions.map((item) => item.id === session.id ? { ...item, startTime: event.currentTarget.value, startTimeOccurrence: null } : item))} aria-invalid={errorTargetId === `session-${session.id}-time` || undefined} aria-describedby={errorTargetId === `session-${session.id}-time` ? "brief-error" : undefined} />
                      {sessionTimeResolution?.status === "ambiguous" && <select aria-label={`Choose which repeated start time for ${session.name || `session ${index + 1}`}`} value={session.startTimeOccurrence ?? ""} onChange={(event) => onUpdateBrief("sessions", brief.sessions.map((item) => item.id === session.id ? { ...item, startTimeOccurrence: event.target.value === "" ? null : event.target.value as "earlier" | "later" } : item))}><option value="">Choose occurrence</option><option value="earlier">Earlier occurrence</option><option value="later">Later occurrence</option></select>}
                      {sessionTimeDisplay && <small className="field-hint">{sessionTimeDisplay}</small>}
                    </label>
                  </div>
                  <label>Expected guests<input id={`session-${session.id}-guests`} aria-label={`Session ${index + 1} expected guests`} type="number" min={1} max={10000} step={1} value={session.guestCount} onChange={(event) => onUpdateBrief("sessions", brief.sessions.map((item) => item.id === session.id ? { ...item, guestCount: Number(event.target.value) } : item))} required aria-invalid={errorTargetId === `session-${session.id}-guests` || undefined} aria-describedby={errorTargetId === `session-${session.id}-guests` ? "brief-error" : undefined} /></label>
                  <button className="icon-button session-remove" type="button" aria-label={`Remove ${session.name || `session ${index + 1}`}`} onClick={() => removeSession(session.id, index)}><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
          <label className="field"><span>Currency code</span><input id="event-currency" className="currency-input" value={brief.currency} onChange={(event) => onUpdateBrief("currency", event.target.value.toUpperCase())} maxLength={3} placeholder="INR" autoCapitalize="characters" required aria-invalid={errorTargetId === "event-currency" || undefined} aria-describedby={errorTargetId === "event-currency" ? "brief-error" : undefined} /></label>
          <label className="field field-full"><span>Total budget</span><span className="input-with-icon money-input"><span className="currency-prefix" aria-hidden="true">{brief.currency || "¤"}</span><input id="budget-amount" inputMode="decimal" value={brief.budgetAmount} onChange={(event) => onUpdateBrief("budgetAmount", event.target.value)} placeholder="250000" required aria-invalid={errorTargetId === "budget-amount" || undefined} aria-describedby={errorTargetId === "budget-amount" ? "budget-help brief-error" : "budget-help"} /></span><small id="budget-help" className="field-hint">Planning cap in the selected currency. Use a period for decimals.</small></label>
          <label className="field field-full"><span>{EVENT_STYLE_PROMPTS[brief.eventType].label}</span><textarea id="event-style" value={brief.style} onChange={(event) => onUpdateBrief("style", event.target.value)} rows={3} maxLength={500} placeholder={EVENT_STYLE_PROMPTS[brief.eventType].placeholder} aria-invalid={errorTargetId === "event-style" || undefined} aria-describedby={errorTargetId === "event-style" ? "brief-error" : undefined} /></label>
          <label className="field field-full"><span>Must-haves &amp; access needs</span><textarea id="event-must-haves" value={brief.mustHaves} onChange={(event) => onUpdateBrief("mustHaves", event.target.value)} rows={3} maxLength={700} placeholder={EVENT_STYLE_PROMPTS[brief.eventType].mustHaves} aria-invalid={errorTargetId === "event-must-haves" || undefined} aria-describedby={errorTargetId === "event-must-haves" ? "brief-error" : undefined} /><small className="field-hint">We keep these visible in the draft instead of treating them as optional ideas.</small></label>
          {isRevision && <label className="field field-full revision-request-field"><span>What changed since this draft?</span><textarea id="revision-request" value={revisionRequest} onChange={(event) => onRevisionRequestChange(event.target.value)} rows={3} minLength={8} maxLength={500} required placeholder="For example: we expect fewer guests, want a quieter welcome, and need to keep the venue accessible." aria-invalid={errorTargetId === "revision-request" || undefined} aria-describedby={errorTargetId === "revision-request" ? "brief-error" : undefined} /><small className="field-hint">Your new proposal will be reviewed separately. The current plan stays in place until you accept it.</small></label>}
        </div>
        {error && <div id="brief-error" className="form-error" role="alert"><CircleAlert size={17} /><span>{error}</span></div>}
        <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{generationAnnouncement}</p>
        <button className="generate-button" type="submit" aria-busy={generating} disabled={generating || hasPendingRevision}>{generating ? <span className="button-spinner" aria-hidden="true" /> : <Sparkles size={17} />} {" "}<span>{generating ? isRevision ? "Drafting your revision…" : "Weaving your first draft…" : isRevision ? "Review a revision" : "Create my plan"}</span>{!generating && <ArrowRight size={17} />}</button>
        <p className="privacy-note"><span className="privacy-dot" /> Live planning sends your event brief to Groq. Revisions also send the current request and earlier accepted revision requests so stated preferences and exclusions can carry forward. Groq says inference data is not retained by default, but may be logged for up to 30 days for reliability or abuse monitoring. Use fictional details and avoid real guest names or sensitive information. <a href="https://console.groq.com/docs/your-data" target="_blank" rel="noreferrer">Groq data policy</a>.</p>
      </form>
    </aside>
  );
}
