import { CalendarDays, Check } from "lucide-react";
import type { EventBrief } from "@/lib/planner";
import {
  canAddTaskDependency,
  canMarkTaskDone,
  canReopenTask,
  resolveTaskDate,
  type TaskRecord,
} from "@/lib/plan-store";

type TaskTimelineSectionProps = {
  tasks: TaskRecord[];
  eventDate: string;
  sessions: EventBrief["sessions"];
  sessionOptions: EventBrief["sessions"];
  editing: boolean;
  scheduleConflicts: Map<string, string[]>;
  onUpdateTask: (taskId: string, update: (current: TaskRecord) => TaskRecord) => void;
};

function sessionScopeLabel(sessions: EventBrief["sessions"], sessionId: string | null): string {
  if (sessionId === null) return "Shared across the event";
  return sessions.find((session) => session.id === sessionId)?.name ?? "Unknown session";
}

export function TaskTimelineSection({
  tasks,
  eventDate,
  sessions,
  sessionOptions,
  editing,
  scheduleConflicts,
  onUpdateTask,
}: TaskTimelineSectionProps) {
  const completeCount = tasks.filter((task) => task.status === "done").length;
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  return (
    <section aria-labelledby="timeline-heading">
      <div className="section-heading timeline-heading">
        <div>
          <span className="section-label">SMALL STEPS, GOOD MOMENTUM</span>
          <h3 id="timeline-heading">Your next steps <span className="task-count">{completeCount}/{tasks.length} done</span></h3>
          <p className="card-intro">Suggested timing is a starting point. Relative dates preview against the current brief and move with event or function dates; fixed due dates stay as entered.</p>
        </div>
        <span className="heading-icon"><CalendarDays size={18} /></span>
      </div>
      <div className="timeline-list">
        {tasks.map((task, index) => {
          const taskDates = resolveTaskDate(task, eventDate, sessions);
          const dependencyTasks = task.dependencyIds
            .map((dependencyId) => taskById.get(dependencyId))
            .filter((dependency): dependency is TaskRecord => dependency !== undefined);
          const unmetDependencyTasks = dependencyTasks.filter((dependency) => dependency.status !== "done");
          const completedDependents = tasks.filter((candidate) => candidate.status === "done" && candidate.dependencyIds.includes(task.id));
          const blocked = task.status !== "done" && !canMarkTaskDone(task, tasks);
          const completedBeforePrerequisites = task.status === "done" && unmetDependencyTasks.length > 0;
          const cannotReopen = task.status === "done" && !canReopenTask(task, tasks);

          return (
            <div className={`timeline-item ${task.status === "done" ? "task-done" : ""}`} key={task.id}>
              <button
                className="task-check"
                type="button"
                aria-label={blocked
                  ? `Complete prerequisite tasks before marking complete: ${unmetDependencyTasks.map((dependency) => dependency.title).join(", ")}`
                  : cannotReopen
                    ? `Mark dependent tasks incomplete first: ${completedDependents.map((dependent) => dependent.title).join(", ")}`
                    : completedBeforePrerequisites
                      ? `Mark incomplete; prerequisites are unfinished: ${unmetDependencyTasks.map((dependency) => dependency.title).join(", ")}`
                      : `${task.status === "done" ? "Mark incomplete" : "Mark complete"}: ${task.title}`}
                aria-pressed={task.status === "done"}
                disabled={blocked || cannotReopen}
                onClick={() => onUpdateTask(task.id, (current) => ({ ...current, status: current.status === "done" ? "todo" : "done" }))}
              >
                {task.status === "done" && <Check size={13} />}
              </button>
              <div className="timeline-copy">
                {editing ? <>
                  <input aria-label={`Task ${index + 1} title`} value={task.title} onChange={(event) => onUpdateTask(task.id, (current) => ({ ...current, title: event.target.value }))} maxLength={120} />
                  <input aria-label={`Task ${index + 1} suggested timing`} value={task.timing} onChange={(event) => onUpdateTask(task.id, (current) => ({ ...current, timing: event.target.value }))} maxLength={80} />
                  <div className="task-meta-edit">
                    <label>Owner<input aria-label={`Task ${index + 1} owner`} value={task.ownerLabel} onChange={(event) => onUpdateTask(task.id, (current) => ({ ...current, ownerLabel: event.target.value }))} maxLength={80} /></label>
                    <label>Fixed due date<input aria-label={`Task ${index + 1} fixed due date`} type="date" value={task.dueDate ?? ""} onInput={(event) => { const dueDate = event.currentTarget.value || null; onUpdateTask(task.id, (current) => ({ ...current, dueDate })); }} /><small>Kept as entered, even if the event date changes.</small></label>
                    <label>Relative offset in calendar days<input aria-label={`Task ${index + 1} relative offset in calendar days`} type="number" min={-3650} max={3650} step={1} value={task.relativeOffsetDays ?? ""} onInput={(event) => { const value = event.currentTarget.value; onUpdateTask(task.id, (current) => ({ ...current, relativeOffsetDays: value === "" ? null : Number(value) })); }} /><small>{taskDates.relativeDate ? `Target ${taskDates.relativeDate} from ${task.sessionId ? "function" : "event"} date ${taskDates.anchorDate}.` : `Negative is before; positive is after. Anchored to the ${task.sessionId ? "assigned function" : "event"} date.`}</small></label>
                    <label>Session / function<select aria-label={`Task ${index + 1} session`} value={task.sessionId ?? ""} onChange={(event) => onUpdateTask(task.id, (current) => ({ ...current, sessionId: event.target.value || null }))}><option value="">Shared / whole event</option>{sessionOptions.map((session) => <option value={session.id} key={session.id}>{session.name}</option>)}</select></label>
                  </div>
                  <fieldset className="task-dependency-edit">
                    <legend>Depends on</legend>
                    {tasks.filter((candidate) => candidate.id !== task.id).map((candidate) => {
                      const checked = task.dependencyIds.includes(candidate.id);
                      const maySelect = checked || (
                        canAddTaskDependency(tasks, task.id, candidate.id)
                        && (task.status !== "done" || candidate.status === "done")
                      );
                      return (
                        <label key={candidate.id} title={!maySelect && task.status === "done" ? "Mark this task incomplete before adding an unfinished prerequisite." : undefined}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!maySelect}
                            onChange={(event) => onUpdateTask(task.id, (current) => ({
                              ...current,
                              dependencyIds: event.target.checked
                                ? [...current.dependencyIds, candidate.id]
                                : current.dependencyIds.filter((dependencyId) => dependencyId !== candidate.id),
                            }))}
                          />
                          <span>{candidate.title}{candidate.status === "done" ? " · done" : ""}</span>
                        </label>
                      );
                    })}
                    <small>Complete prerequisites before this task. Choices that create a cycle or add an unfinished prerequisite to a completed task are unavailable.</small>
                  </fieldset>
                </> : <>
                  <strong>{task.title}</strong>
                  <span><CalendarDays size={13} />{taskDates.dueDate || task.timing} · {task.ownerLabel} · {sessionScopeLabel(sessions, task.sessionId)}</span>
                  {task.relativeOffsetDays !== null && <small className="task-date-note">Relative target: {taskDates.relativeDate ?? "waiting for its anchor date"}{taskDates.fixedDate ? ` · fixed date stays ${taskDates.fixedDate}` : " · no fixed date"}</small>}
                  {dependencyTasks.length > 0 && <span className="task-dependency-summary">Depends on: {dependencyTasks.map((dependency) => dependency.title).join(", ")}</span>}
                </>}
                {blocked && <span className="task-blocked">Waiting on: {unmetDependencyTasks.map((dependency) => dependency.title).join(", ")}</span>}
                {completedBeforePrerequisites && <span className="task-blocked">Marked complete before prerequisites: {unmetDependencyTasks.map((dependency) => dependency.title).join(", ")}</span>}
                {cannotReopen && <span className="task-blocked">Mark incomplete first: {completedDependents.map((dependent) => dependent.title).join(", ")}</span>}
                {scheduleConflicts.get(task.id)?.map((conflict) => <span className="task-schedule-warning" key={conflict}>Schedule check: {conflict}</span>)}
              </div>
              <span className={`priority priority-${task.priority}`}>{task.priority}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
