import { Clock, Plus, StickyNote } from 'lucide-react';
import {
  buildCalendarMergeSegments,
  dateKey,
  getCalendarEventKey,
  getOverlappingCellMerge,
  getTaskCalendarDisplay,
  getTaskDurationMinutes,
  mergeAdjacentSameTitleBlocks,
  startOfDay,
} from '@/lib/calendarUtils';
import { formatTimeOnly, HOURS_IN_DAY, nowMs } from '@/lib/calendarPageHelpers';

const WeekDayView = ({
  viewMode,
  calendarDays,
  calendarNotes,
  taskByDate,
  cellsSelecting,
  calendarGridRef,
  currentDayKey,
  currentTimePercentage,
  selectionRect,
  movingTask,
  resizingTask,
  locale,
  language,
  t,
  getTaskResizeEdgeAtPoint,
  beginTaskResize,
  consumeSuppressedClick,
  openTaskScheduleModal,
  beginCellDrag,
  startLongPress,
  openCellMenuAt,
  longPressAtRef,
  beginMoveTaskDrag,
  beginTaskPointerDrag,
  openTaskPreviewModal,
  setSelectedDate,
  setViewMode,
  openNoteModal,
}) => (
  <section className='overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-600 dark:bg-slate-800/90'>
    <div className='flex border-b border-slate-200/90 dark:border-slate-600'>
      <div className='w-14 shrink-0 border-r border-slate-200/90 bg-slate-50/50 p-2 text-center text-[11px] font-bold text-slate-400 dark:border-slate-600 dark:bg-slate-900/30'>
        GMT
      </div>
      <div
        className={`grid flex-1 divide-x divide-slate-100 dark:divide-slate-600/80 ${
          viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'
        }`}
      >
        {calendarDays.map((date) => {
          const dayKey = dateKey(date);
          const isToday = dayKey === currentDayKey;

          return (
            <div
              key={dayKey}
              className={`py-3 text-center transition-colors ${
                isToday ? 'bg-violet-50/30 dark:bg-violet-900/10' : ''
              }`}
            >
              <p className='text-xs font-bold uppercase text-slate-400 dark:text-slate-500'>
                {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)}
              </p>
              <button
                type='button'
                onClick={() => {
                  setSelectedDate(date);
                  setViewMode('day');
                }}
                className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-3xl text-sm font-extrabold transition ${
                  isToday
                    ? 'bg-violet-600 text-white shadow-xs shadow-violet-500/40'
                    : 'text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>

    <div className='flex border-b border-slate-200/90 bg-slate-50/70 dark:border-slate-600 dark:bg-slate-900/40'>
      <div className='flex w-14 shrink-0 items-center justify-center border-r border-slate-200/90 p-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-600'>
        Notes
      </div>
      <div
        className={`grid flex-1 divide-x divide-slate-100 p-1.5 dark:divide-slate-600/80 ${
          viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'
        }`}
      >
        {calendarDays.map((date) => {
          const dayKey = dateKey(date);
          const dayNote = calendarNotes?.[dayKey]?.content || '';

          return (
            <div key={dayKey} className='px-1'>
              {dayNote ? (
                <div
                  onClick={() => openNoteModal(date)}
                  className='flex cursor-pointer items-center gap-1.5 truncate rounded-3xl border border-amber-300 bg-amber-100/90 px-2.5 py-1 text-xs font-bold text-amber-950 shadow-xs transition hover:scale-[1.02] dark:border-amber-600/80 dark:bg-amber-900/50 dark:text-amber-200'
                  title={dayNote}
                >
                  <StickyNote className='h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400' />
                  <span className='truncate'>{dayNote}</span>
                </div>
              ) : (
                <button
                  type='button'
                  onClick={() => openNoteModal(date)}
                  className='flex w-full items-center justify-center gap-1 rounded-3xl border border-dashed border-slate-300/80 py-1 text-[11px] font-medium text-slate-400 transition hover:border-violet-400 hover:text-violet-600 dark:border-slate-500 dark:hover:border-violet-500'
                >
                  <Plus className='h-3 w-3' />
                  <span>{language === 'vi' ? 'Ghi chú' : 'Add note'}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>

    <div data-calendar-gesture-zone='true' className={`sidebar-scrollbar relative max-h-[620px] touch-pan-y overflow-y-auto ${cellsSelecting ? 'select-none' : ''}`}>
      <div className='flex'>
        <div className='w-14 shrink-0 divide-y divide-transparent border-r border-slate-200/80 dark:border-slate-600'>
          {HOURS_IN_DAY.map((hour) => (
            <div
              key={hour}
              className='flex h-14 items-center justify-end pr-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500'
            >
              <span>{String(hour).padStart(2, '0')}:00</span>
            </div>
          ))}
        </div>

        <div
          ref={calendarGridRef}
          className={`grid flex-1 divide-x divide-slate-100 dark:divide-slate-600/70 ${
            cellsSelecting ? 'select-none' : ''
          } ${
            viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'
          }`}
        >
          {calendarDays.map((date, dayIndex) => {
            const dayKey = dateKey(date);
            const isToday = dayKey === currentDayKey;
            const dayTasks = taskByDate.get(dayKey) || [];
            const dayNote = calendarNotes?.[dayKey]?.content || '';
            const dayMerges = calendarNotes?.[dayKey]?.merges || [];
            const dayStartMs = startOfDay(date).getTime();
            const scheduledIntervals = dayTasks.flatMap((task) => {
              const display = getTaskCalendarDisplay(task, date);
              if (display?.kind !== 'scheduled') return [];
              const startHour = Math.max(
                0,
                Math.floor((display.startMs - dayStartMs) / 3600000)
              );
              const endHour = Math.min(
                24,
                Math.ceil((display.endMs - dayStartMs) / 3600000)
              );
              if (endHour <= startHour) return [];
              return [{
                identity: getCalendarEventKey(task),
                task,
                startMs: dayStartMs + startHour * 3600000,
                endMs: dayStartMs + endHour * 3600000,
              }];
            });
            const taskSegments = buildCalendarMergeSegments(scheduledIntervals);
            const scheduledRangeByIdentity = new Map(
              scheduledIntervals.map((interval) => [interval.identity, interval])
            );
            const scheduledTaskBlocks = mergeAdjacentSameTitleBlocks(
              taskSegments.valid
                ? taskSegments.segments.map((segment) => ({
                    identity: segment.identityKeys.join('+'),
                    task: segment.members[0]?.task,
                    members: segment.members,
                    startMs: segment.startMs,
                    endMs: segment.endMs,
                    memberIndex: 0,
                    memberCount: 1,
                    isVirtualGroup: segment.members.length > 1,
                    isTaskStart: segment.members.length === 1
                      && segment.startMs === scheduledRangeByIdentity.get(
                        segment.members[0].identity
                      )?.startMs,
                    isTaskEnd: segment.members.length === 1
                      && segment.endMs === scheduledRangeByIdentity.get(
                        segment.members[0].identity
                      )?.endMs,
                    isSameTitleMerge: segment.members.length > 1
                      && segment.members.every(({ task }) => task?.title === segment.members[0]?.task?.title),
                  }))
                : scheduledIntervals.map((interval) => ({
                    ...interval,
                    members: [{ identity: interval.identity, task: interval.task }],
                    memberIndex: 0,
                    memberCount: 1,
                    isTaskStart: true,
                    isTaskEnd: true,
                    isSameTitleMerge: false,
                  }))
            );
            const deadlineTaskBlocks = dayTasks.flatMap((task) => {
              const display = getTaskCalendarDisplay(task, date);
              if (display?.kind !== 'deadline') return [];
              const startHour = Math.max(
                0,
                Math.floor((display.startMs - dayStartMs) / 3600000)
              );
              const endHour = Math.min(
                24,
                Math.ceil((display.endMs - dayStartMs) / 3600000)
              );
              return [{
                identity: getCalendarEventKey(task),
                task,
                startMs: dayStartMs + startHour * 3600000,
                endMs: dayStartMs + Math.max(startHour + 1, endHour) * 3600000,
                memberIndex: 0,
                memberCount: 1,
                isTaskStart: true,
                isTaskEnd: true,
              }];
            });

            return (
              <div
                key={dayKey}
                data-calendar-day-index={dayIndex}
                className={`relative ${isToday ? 'bg-violet-50/15 dark:bg-violet-900/5' : ''}`}
              >
                {isToday ? (
                  <div
                    className='pointer-events-none absolute left-0 right-0 z-20 flex items-center'
                    style={{ top: `${currentTimePercentage}%` }}
                  >
                    <span className='-ml-1.5 h-3 w-3 rounded-full bg-rose-500 shadow-sm' />
                    <div className='h-0.5 flex-1 bg-rose-500' />
                  </div>
                ) : null}

                {HOURS_IN_DAY.map((hour) => {
                  const insideMergedRange = dayMerges.some(
                    (merge) => hour > merge.startHour && hour <= merge.endHour
                  );
                  return (
                    <div
                      key={hour}
                      data-calendar-hour={hour}
                      onClick={() => {
                        if (consumeSuppressedClick()) return;
                        openTaskScheduleModal(date, null, hour);
                      }}
                      onMouseDown={(event) => beginCellDrag(event, dayIndex, hour)}
                      onTouchStart={(event) => startLongPress(event, dayIndex, hour, hour)}
                      onContextMenu={(event) => openCellMenuAt(event, dayIndex, hour, hour)}
                      className={`relative h-14 cursor-pointer transition-colors hover:bg-violet-50/50 dark:hover:bg-violet-900/20 ${
                        hour > 0 && !insideMergedRange
                          ? 'border-t border-slate-200/90 dark:border-slate-500/60'
                          : ''
                      }`}
                    />
                  );
                })}

                {selectionRect && selectionRect.startDay === dayIndex ? (
                  <div
                    className='pointer-events-none absolute inset-x-0 z-40 rounded-3xl border border-violet-400/70 bg-violet-300/40 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.2)] dark:border-violet-300/70 dark:bg-violet-500/25'
                    style={{
                      top: `${selectionRect.startHour * 56}px`,
                      height: `${(selectionRect.endHour - selectionRect.startHour + 1) * 56}px`,
                    }}
                  />
                ) : null}

                {dayMerges.map((merge) => {
                  const mergeHasTask = dayTasks.some((task) => {
                    const display = getTaskCalendarDisplay(task, date);
                    if (!display || display.kind !== 'scheduled') return false;
                    const displayStart = new Date(display.startMs);
                    const startMins = displayStart.getHours() * 60 + displayStart.getMinutes();
                    const duration = Math.max(1, (display.endMs - display.startMs) / 60000);
                    const blockStartHour = Math.floor(startMins / 60);
                    const blockEndHour = Math.min(24, Math.ceil((startMins + duration) / 60));
                    return blockStartHour >= merge.startHour && blockEndHour - 1 <= merge.endHour;
                  });

                  if (mergeHasTask) return null;

                  return (
                    <div
                      key={`merge-${merge.startHour}-${merge.endHour}`}
                      data-calendar-range-start={merge.startHour}
                      data-calendar-range-end={merge.endHour}
                      onMouseDown={(event) => beginCellDrag(event, dayIndex, merge.startHour, merge.endHour)}
                      onClick={() => {
                        if (consumeSuppressedClick()) return;
                        openTaskScheduleModal(date, null, merge.startHour, merge.endHour, true);
                      }}
                      onTouchStart={(event) => startLongPress(event, dayIndex, merge.startHour, merge.endHour)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        if (nowMs() - longPressAtRef.current < 800) return;
                        openCellMenuAt(event, dayIndex, merge.startHour, merge.endHour);
                      }}
                      style={{
                        top: `${merge.startHour * 56 + 4}px`,
                        height: `${Math.max(40, (merge.endHour - merge.startHour + 1) * 56 - 8)}px`,
                      }}
                      title={
                        dayNote ||
                        (language === 'vi'
                          ? 'Ô đã gộp — bấm để thêm công việc, chuột phải để mở menu'
                          : 'Merged cells — click to add a task, right-click for the menu')
                      }
                      className='group absolute inset-x-1 z-[5] flex cursor-pointer select-none flex-col items-center justify-center gap-1.5 overflow-hidden rounded-3xl border border-violet-200/70 bg-violet-50/50 p-2 text-center opacity-60 transition-colors hover:bg-violet-100/60 dark:border-violet-300/70 dark:bg-violet-900/20 dark:hover:bg-violet-900/35'
                    >
                      {dayNote ? (
                        <p className='line-clamp-3 w-full min-w-0 break-words [overflow-wrap:anywhere] px-1 text-[11px] font-semibold leading-snug text-amber-900 dark:text-amber-200'>
                          {dayNote}
                        </p>
                      ) : (
                        <StickyNote className='h-4 w-4 shrink-0 text-violet-300 opacity-0 transition-opacity group-hover:opacity-60 dark:text-violet-600' />
                      )}
                    </div>
                  );
                })}

                {[...scheduledTaskBlocks, ...deadlineTaskBlocks].map((block) => {
                  const {
                    identity,
                    task,
                    members = [{ identity, task }],
                    memberIndex,
                    memberCount,
                    isSameTitleMerge,
                  } = block;
                  const display = getTaskCalendarDisplay(task, date);
                  if (!display) return null;

                  const blockStartHour = Math.floor(
                    (block.startMs - dayStartMs) / 3600000
                  );
                  const blockEndHour = Math.min(
                    24,
                    Math.ceil((block.endMs - dayStartMs) / 3600000)
                  );
                  const topPx = blockStartHour * 56 + 4;
                  const heightPx = Math.max(40, (blockEndHour - blockStartHour) * 56 - 8);
                  const taskStartHour = blockStartHour;
                  const taskEndHour = blockEndHour;
                  const isDeadline = display.kind === 'deadline';
                  const isContinuation = !isDeadline
                    && display.originalStartMs < startOfDay(date).getTime();
                  const overlappingMerge = getOverlappingCellMerge(
                    taskStartHour,
                    taskEndHour - 1,
                    dayMerges
                  );
                  const dragStartHour = overlappingMerge ? overlappingMerge.startHour : taskStartHour;
                  const isMergedTask = (
                    (Array.isArray(task.mergedTasks) && task.mergedTasks.length > 0)
                    || (Array.isArray(task.mergedOccurrences) && task.mergedOccurrences.length > 0)
                  );
                  const dragEndHour = overlappingMerge
                    ? overlappingMerge.endHour
                    : isMergedTask
                      ? taskEndHour - 1
                      : taskStartHour;
                  const menuStartHour = taskStartHour;
                  const menuEndHour = Math.min(
                    23,
                    Math.max(menuStartHour, taskEndHour - 1)
                  );
                  const isMovingThisTask = movingTask?.taskId === task._id
                    && (movingTask.calendarOccurrenceId || 'primary')
                      === (task.calendarOccurrenceId || 'primary');
                  const isResizingThisTask = resizingTask?.taskId === task._id
                    && resizingTask.calendarOccurrenceId === (task.calendarOccurrenceId || 'primary');
                  const isResizableTask = display.kind === 'scheduled'
                    && !isContinuation
                    && !isSameTitleMerge
                    && (block.isTaskStart || block.isTaskEnd);
                  const laneWidth = 100 / memberCount;
                  const onResizePointerDown = isResizableTask
                    ? (event) => {
                        if (event.pointerType === 'touch') return;
                        const edge = getTaskResizeEdgeAtPoint(event);
                        if (
                          (edge === 'start' && block.isTaskStart)
                          || (edge === 'end' && block.isTaskEnd)
                        ) beginTaskResize(event, task, dayIndex, edge);
                      }
                    : undefined;
                  const onResizePointerMove = isResizableTask
                    ? (event) => {
                        const edge = getTaskResizeEdgeAtPoint(event);
                        event.currentTarget.style.cursor = (
                          (edge === 'start' && block.isTaskStart)
                          || (edge === 'end' && block.isTaskEnd)
                        ) ? 'ns-resize' : '';
                      }
                    : undefined;

                  return (
                    <div
                      key={`${identity}:${block.startMs}:${block.endMs}`}
                      onPointerDownCapture={onResizePointerDown}
                      onPointerMoveCapture={onResizePointerMove}
                      onPointerLeave={(event) => {
                        event.currentTarget.style.cursor = '';
                      }}
                      style={{
                        top: `${topPx}px`,
                        height: `${heightPx}px`,
                        left: `calc(${memberIndex * laneWidth}% + 4px)`,
                        width: `calc(${laneWidth}% - 8px)`,
                      }}
                      className={`group/task absolute z-10 transition-transform hover:z-30 hover:scale-[1.01] ${
                        isResizableTask ? 'pointer-events-auto' : 'pointer-events-none'
                      }`}
                    >
                      <div
                        data-task-card
                        {...(overlappingMerge || isMergedTask
                          ? {
                              'data-calendar-range-start': dragStartHour,
                              'data-calendar-range-end': dragEndHour,
                            }
                          : {})}
                        {...(isMovingThisTask ? { 'data-moving-task-frame': '' } : {})}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (consumeSuppressedClick()) return;
                          if (isMovingThisTask) return;
                          openTaskPreviewModal(date, {
                             ...task,
                             virtualMembers: members.map(({ identity: memberIdentity, task: memberTask }) => ({
                               identity: memberIdentity,
                               taskId: memberTask._id,
                               occurrenceId: memberTask.calendarOccurrenceId || 'primary',
                               title: memberTask.title,
                               startAt: memberTask.startAt,
                               dueAt: memberTask.dueAt,
                               estimatedMinutes: getTaskDurationMinutes(memberTask),
                             })),
                           });
                        }}
                        onPointerDown={(event) => {
                          if (isMovingThisTask) {
                            beginMoveTaskDrag(event);
                            return;
                          }
                          beginTaskPointerDrag(
                            event,
                            task,
                            dayIndex,
                            date,
                            overlappingMerge,
                            members,
                            block.startMs,
                            block.endMs,
                            isSameTitleMerge
                          );
                        }}
                        onTouchStart={(event) => startLongPress(event, dayIndex, menuStartHour, menuEndHour)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          if (nowMs() - longPressAtRef.current < 800) return;
                          openCellMenuAt(event, dayIndex, menuStartHour, menuEndHour);
                        }}
                        title={`${task.title}${isDeadline ? ` — ${t.dueDate}` : ''}`}
                        className={`pointer-events-auto absolute inset-0 flex touch-none select-none flex-col items-center justify-center overflow-hidden rounded-3xl border p-2 text-center text-white shadow-md transition-[opacity,box-shadow] duration-150 ease-out group-hover/task:shadow-lg ${
                          isMovingThisTask ? 'cursor-move ring-2 ring-violet-300' : 'cursor-pointer'
                        } ${
                          isResizingThisTask ? 'opacity-35' : ''
                        } ${
                          isDeadline
                            ? 'border-amber-300 bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20 dark:border-amber-300'
                            : 'border-violet-300 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 shadow-violet-500/20 dark:border-violet-400'
                        }`}
                      >
                        {(() => {
                          const memberTitles = [...new Set(members.map(({ task: memberTask }) => memberTask?.title || '').filter(Boolean))];
                          const stackedTitleCapacity = Math.max(1, Math.floor((heightPx - 30) / 14));
                          const showStackedTitles = memberTitles.length > 1 && memberTitles.length <= stackedTitleCapacity;
                          return (
                            <div className='flex w-full min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden text-xs font-bold leading-tight'>
                              {showStackedTitles
                                ? memberTitles.map((memberTitle, index) => (
                                    <span key={identity + ':' + index} className='min-w-0 w-full truncate'>{memberTitle}</span>
                                  ))
                                : <span className='min-w-0 w-full break-words [overflow-wrap:anywhere]'>{memberTitles.join(' • ')}</span>}
                            </div>
                          );
                        })()}
                        <p className='flex min-w-0 items-center gap-1 text-[10px] font-semibold opacity-90'>
                          <Clock className='h-2.5 w-2.5 shrink-0' />
                          <span className='min-w-0 truncate'>
                            {isContinuation ? '↳ ' : ''}
                            {formatTimeOnly(block.startMs, locale)}
                          </span>
                        </p>
                        {isResizableTask ? (
                          <>
                            {block.isTaskStart ? (
                              <span
                                aria-hidden='true'
                                onPointerDown={(event) => {
                                  if (event.pointerType !== 'touch') return;
                                  beginTaskResize(event, task, dayIndex, 'start');
                                }}
                                onTouchStart={(event) => event.stopPropagation()}
                                onClick={(event) => event.stopPropagation()}
                                className='absolute left-1/2 top-0.5 z-20 flex h-1.5 w-5 -translate-x-1/2 touch-none items-center justify-center bg-transparent md:hidden'
                              >
                                <span className='pointer-events-none h-0.5 w-4 rounded-full bg-white/60' />
                              </span>
                            ) : null}
                            {block.isTaskEnd ? (
                              <span
                                aria-hidden='true'
                                onPointerDown={(event) => {
                                  if (event.pointerType !== 'touch') return;
                                  beginTaskResize(event, task, dayIndex, 'end');
                                }}
                                onTouchStart={(event) => event.stopPropagation()}
                                onClick={(event) => event.stopPropagation()}
                                className='absolute bottom-0.5 left-1/2 z-20 flex h-1.5 w-5 -translate-x-1/2 touch-none items-center justify-center bg-transparent md:hidden'
                              >
                                <span className='pointer-events-none h-0.5 w-4 rounded-full bg-white/60' />
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {resizingTask?.dayIndex === dayIndex ? (
                  <div
                    aria-hidden='true'
                    className='pointer-events-none absolute inset-x-1 z-40 rounded-3xl border-2 border-dashed border-violet-500 bg-violet-300/30 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.2)] transition-[top,height] duration-150 ease-out dark:border-violet-300 dark:bg-violet-500/25'
                    style={{
                      top: `${resizingTask.startHour * 56 + 4}px`,
                      height: `${Math.max(40, (resizingTask.endHour - resizingTask.startHour + 1) * 56 - 8)}px`,
                    }}
                  />
                ) : null}

                {movingTask && movingTask.dayIndex === dayIndex ? (
                  <div
                    data-moving-task-frame
                    onPointerDown={beginMoveTaskDrag}
                    className='absolute inset-x-1 z-40 cursor-move touch-none rounded-3xl border-2 border-violet-600/80 bg-violet-500/5 shadow-lg shadow-violet-500/10 dark:border-violet-300'
                    style={{
                      top: `${movingTask.startHour * 56 + 4}px`,
                      height: `${Math.max(40, movingTask.spanHours * 56 - 8)}px`,
                    }}
                  >
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </section>
);

export default WeekDayView;
