import { z } from "zod";
import { addCalendarDays } from "./schedule.ts";
import type { EventBrief } from "./planner.ts";
import { dateOnlySchema, idSchema } from "./plan-record-primitives.ts";

export const taskRecordSchema = z
  .object({
    id: idSchema,
    title: z.string().trim().min(5).max(120),
    timing: z.string().trim().min(3).max(80),
    priority: z.enum(["high", "medium", "low"]),
    status: z.enum(["todo", "in_progress", "done", "blocked"]),
    ownerLabel: z.string().trim().max(80),
    dueDate: dateOnlySchema.nullable(),
    relativeOffsetDays: z
      .number()
      .int()
      .min(-3650)
      .max(3650)
      .nullable()
      .default(null),
    dependencyIds: z.array(idSchema).max(20),
    sessionId: idSchema.nullable().default(null),
  })
  .strict();

export type TaskRecord = z.infer<typeof taskRecordSchema>;

export type TaskDateResolution = {
  anchorDate: string | null;
  relativeDate: string | null;
  fixedDate: string | null;
  dueDate: string | null;
};

export function resolveTaskDate(
  task: Pick<TaskRecord, "dueDate" | "relativeOffsetDays" | "sessionId">,
  eventDate: string,
  sessions: readonly Pick<EventBrief["sessions"][number], "id" | "date">[] = [],
): TaskDateResolution {
  const session = task.sessionId
    ? sessions.find((item) => item.id === task.sessionId)
    : null;
  const anchorDate = task.sessionId ? session?.date || null : eventDate || null;
  const relativeDate =
    task.relativeOffsetDays === null || !anchorDate
      ? null
      : addCalendarDays(anchorDate, task.relativeOffsetDays);
  return {
    anchorDate,
    relativeDate,
    fixedDate: task.dueDate,
    dueDate: task.dueDate ?? relativeDate,
  };
}

export function canAddTaskDependency(
  tasks: readonly Pick<TaskRecord, "id" | "dependencyIds">[],
  taskId: string,
  dependencyId: string,
): boolean {
  if (taskId === dependencyId) return false;
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const currentTask = taskById.get(taskId);
  if (
    !currentTask ||
    !taskById.has(dependencyId) ||
    currentTask.dependencyIds.includes(dependencyId)
  )
    return false;

  const pending = [dependencyId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const currentId = pending.pop();
    if (!currentId || visited.has(currentId)) continue;
    if (currentId === taskId) return false;
    visited.add(currentId);
    pending.push(...(taskById.get(currentId)?.dependencyIds ?? []));
  }
  return true;
}

export function canMarkTaskDone(
  task: Pick<TaskRecord, "dependencyIds">,
  tasks: readonly Pick<TaskRecord, "id" | "status">[],
): boolean {
  const taskById = new Map(tasks.map((item) => [item.id, item]));
  return task.dependencyIds.every(
    (dependencyId) => taskById.get(dependencyId)?.status === "done",
  );
}

export function canReopenTask(
  task: Pick<TaskRecord, "id" | "status">,
  tasks: readonly Pick<TaskRecord, "status" | "dependencyIds">[],
): boolean {
  return (
    task.status !== "done" ||
    !tasks.some(
      (candidate) =>
        candidate.status === "done" &&
        candidate.dependencyIds.includes(task.id),
    )
  );
}

export function taskScheduleConflicts(
  tasks: readonly TaskRecord[],
  eventDate = "",
  today = "",
  sessions: readonly Pick<EventBrief["sessions"][number], "id" | "date">[] = [],
): Map<string, string[]> {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const conflicts = new Map<string, string[]>();

  for (const task of tasks) {
    const messages: string[] = [];
    const dates = resolveTaskDate(task, eventDate, sessions);
    const dueDate = dates.dueDate;
    if (task.relativeOffsetDays !== null && !dates.relativeDate) {
      messages.push(
        task.sessionId
          ? "Set this function's date to resolve its relative task date."
          : "Set the event date to resolve this relative task date.",
      );
    }
    if (
      dates.relativeDate &&
      task.dueDate &&
      dates.relativeDate !== task.dueDate
    ) {
      messages.push(
        `The relative target is ${dates.relativeDate}, but the fixed due date remains ${task.dueDate}; review the commitment before moving it.`,
      );
    }
    const anchorLabel = task.sessionId ? "function date" : "event date";
    if (
      dates.anchorDate &&
      dates.fixedDate &&
      dates.fixedDate > dates.anchorDate
    ) {
      messages.push(
        `This task is due ${dates.fixedDate}, after the ${anchorLabel} ${dates.anchorDate}.`,
      );
    } else if (
      dates.anchorDate &&
      !dates.fixedDate &&
      dates.relativeDate &&
      dates.relativeDate > dates.anchorDate
    ) {
      messages.push(
        `This relative task target is ${dates.relativeDate}, after the ${anchorLabel} ${dates.anchorDate}.`,
      );
    }
    if (dueDate && today && dueDate < today && task.status !== "done") {
      messages.push(`This task was due ${dueDate} and is still open.`);
    }
    if (dueDate) {
      const laterPrerequisites = task.dependencyIds
        .map((dependencyId) => taskById.get(dependencyId))
        .map((dependency) =>
          dependency
            ? {
                task: dependency,
                dueDate: resolveTaskDate(dependency, eventDate, sessions)
                  .dueDate,
              }
            : null,
        )
        .filter(
          (dependency): dependency is { task: TaskRecord; dueDate: string } =>
            dependency !== null &&
            dependency.dueDate !== null &&
            dependency.dueDate > dueDate,
        );
      messages.push(
        ...laterPrerequisites.map(
          ({ task: dependency, dueDate: dependencyDate }) =>
            `${dependency.title} is due ${dependencyDate}, after this task.`,
        ),
      );
    }
    if (messages.length > 0) conflicts.set(task.id, messages);
  }

  return conflicts;
}
