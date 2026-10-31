import { useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Check, Plus } from "lucide-react";
import type { ChecklistTask } from "@/lib/organizer-model";

export default function OrganizerChecklist({
  tasks,
  checked,
  completion,
  overview,
  onToggle,
  onAddTask,
  onShowChecklist,
}: {
  tasks: readonly ChecklistTask[];
  checked: readonly string[];
  completion: number;
  overview: boolean;
  onToggle: (title: string) => void;
  onAddTask: (title: string) => boolean;
  onShowChecklist: () => void;
}) {
  const [task, setTask] = useState("");
  function addTask(event: FormEvent) {
    event.preventDefault();
    if (onAddTask(task)) setTask("");
  }
  return (
    <section className="workspace-panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">ONE THING AT A TIME.</span>
          <h3>
            {overview
              ? "Your next little steps."
              : "A little list. A lot of progress."}
          </h3>
        </div>
        <span className="completion-label">{completion}% together</span>
      </div>
      <div
        className="completion-track"
        role="progressbar"
        aria-label="Checklist completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completion}
      >
        <span style={{ width: `${completion}%` }} />
      </div>
      <div className="task-list">
        {(overview ? tasks.slice(0, 4) : tasks).map((item) => (
          <label
            key={item.title}
            className={`task-row ${checked.includes(item.title) ? "done" : ""}`}
          >
            <input
              type="checkbox"
              checked={checked.includes(item.title)}
              onChange={() => onToggle(item.title)}
            />
            <span className="task-checkbox" aria-hidden="true">
              <Check size={12} />
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.timing}</small>
            </span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </label>
        ))}
      </div>
      {overview ? (
        <button className="text-link" onClick={onShowChecklist}>
          See the whole checklist <ArrowRight size={15} />
        </button>
      ) : (
        <form onSubmit={addTask} className="add-task">
          <input
            maxLength={120}
            required
            value={task}
            onChange={(event) => setTask(event.target.value)}
            placeholder="One more thing to remember…"
            aria-label="New checklist task"
          />
          <button type="submit" className="icon-button" aria-label="Add task">
            <Plus size={18} />
          </button>
        </form>
      )}
    </section>
  );
}
