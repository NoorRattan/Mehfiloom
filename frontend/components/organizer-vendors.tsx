import type { PlannerProposal } from "@/lib/planner";

export default function OrganizerVendors({
  vendors,
  notes,
  onChangeNote,
}: {
  vendors: PlannerProposal["vendorChecklist"];
  notes: Record<string, string>;
  onChangeNote: (category: string, note: string) => void;
}) {
  const currentCategories = new Set(vendors.map((group) => group.category));
  const groups = [
    ...vendors.map((group) => ({ ...group, previous: false })),
    ...Object.keys(notes)
      .filter((category) => !currentCategories.has(category))
      .map((category) => ({ category, questions: [], previous: true })),
  ];
  return (
    <section className="workspace-panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">GOOD PEOPLE TO HAVE ON YOUR SIDE.</span>
          <h3>Your vendor conversations.</h3>
        </div>
      </div>
      <p className="panel-description">
        Keep your questions and notes together as you find your people.
      </p>
      {groups.map((group) => (
        <details className="vendor-details" key={group.category}>
          <summary>
            {group.category}
            <span aria-hidden="true">+</span>
          </summary>
          {group.previous && (
            <p className="small-note">Saved notes from an earlier plan.</p>
          )}
          {group.questions.length > 0 && (
            <ul>
              {group.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          )}
          <label className="field">
            <span>Your notes</span>
            <textarea
              maxLength={1000}
              rows={3}
              value={notes[group.category] ?? ""}
              onChange={(event) =>
                onChangeNote(group.category, event.target.value)
              }
              placeholder="Contact details, quotes, availability, next steps…"
            />
          </label>
        </details>
      ))}
    </section>
  );
}
