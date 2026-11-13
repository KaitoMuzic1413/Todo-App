const DEFAULT_SLOT_MINUTES = 30;
const SNAPSHOT_FIELDS = [
  'title',
  'contentType',
  'content',
  'items',
  'status',
  'completedAt',
  'startAt',
  'dueAt',
  'estimatedMinutes',
  'timeZone',
  'important',
  'parentTaskId',
];

const getTaskId = (task) => String(task?._id ?? task?.id ?? '');
const normalizeTitle = (title) => String(title ?? '').trim().toLocaleLowerCase();

const getTaskInterval = (task, fallbackDurationMinutes = DEFAULT_SLOT_MINUTES) => {
  const start = new Date(task?.startAt).getTime();
  if (!Number.isFinite(start)) return null;

  const duration = Number(task.estimatedMinutes) > 0
    ? Number(task.estimatedMinutes)
    : fallbackDurationMinutes;
  return { start, end: start + duration * 60_000 };
};

const snapshotTask = (task) => ({
  taskId: getTaskId(task),
  taskData: Object.fromEntries(SNAPSHOT_FIELDS
    .filter((field) => Object.hasOwn(task, field))
    .map((field) => [field, task[field]])),
});

/**
 * Splits a dragged task's occupied time into independent merge segments.
 * A segment is created only when its cell has a distinct set of task members.
 * Tasks with the same normalized title as the dragged task are absorbed into it.
 */
export const buildCellMergeSegments = ({
  baseTask,
  tasks = [],
  startAt = baseTask?.startAt,
  cellCount,
  slotMinutes = DEFAULT_SLOT_MINUTES,
}) => {
  const baseId = getTaskId(baseTask);
  const rangeStart = new Date(startAt).getTime();

  if (!baseId) throw new TypeError('baseTask must have an id.');
  if (!Number.isFinite(rangeStart)) throw new TypeError('startAt must be a valid date.');
  if (!Number.isInteger(cellCount) || cellCount < 1) {
    throw new RangeError('cellCount must be a positive integer.');
  }
  if (!Number.isFinite(slotMinutes) || slotMinutes <= 0) {
    throw new RangeError('slotMinutes must be greater than zero.');
  }

  const baseTitle = normalizeTitle(baseTask.title);
  const candidates = tasks
    .filter((task) => getTaskId(task) && getTaskId(task) !== baseId)
    .filter((task) => normalizeTitle(task.title) !== baseTitle)
    .map((task) => ({ task, interval: getTaskInterval(task, slotMinutes) }))
    .filter(({ interval }) => interval);

  const cellDuration = slotMinutes * 60_000;
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const cellStart = rangeStart + index * cellDuration;
    const cellEnd = cellStart + cellDuration;
    const members = [baseTask];

    for (const candidate of candidates) {
      if (candidate.interval.start < cellEnd && candidate.interval.end > cellStart) {
        members.push(candidate.task);
      }
    }

    const uniqueMembers = [...new Map(members.map((task) => [getTaskId(task), task])).values()];
    return {
      index,
      cellStart: new Date(cellStart).toISOString(),
      cellEnd: new Date(cellEnd).toISOString(),
      members: uniqueMembers,
      memberIds: uniqueMembers.map(getTaskId).sort(),
    };
  });

  const segments = [];
  let active = null;

  for (const cell of cells) {
    if (cell.members.length < 2) {
      active = null;
      continue;
    }

    const signature = cell.memberIds.join('|');
    if (active && active.signature === signature && active.endCell === cell.index) {
      active.endCell += 1;
      active.endAt = cell.cellEnd;
      continue;
    }

    active = {
      id: `${baseId}:${cell.index}:${signature}`,
      signature,
      startCell: cell.index,
      endCell: cell.index + 1,
      startAt: cell.cellStart,
      endAt: cell.cellEnd,
      memberIds: cell.memberIds,
      members: cell.members.map(snapshotTask),
    };
    segments.push(active);
  }

  return segments.map(({ signature: _signature, ...segment }) => segment);
};

/** Restores full original task snapshots without mutating the merge segment. */
export const restoreMergeMembers = (mergeSegment) => {
  if (!Array.isArray(mergeSegment?.members)) {
    throw new TypeError('mergeSegment.members must be an array.');
  }

  return mergeSegment.members.map((member) => ({
    taskId: String(member.taskId),
    ...structuredClone(member.taskData ?? {}),
  }));
};
