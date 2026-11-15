import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, Clock, Split, Trash2, X } from 'lucide-react';
import SelectMenu from '@/components/ui/select-menu';
import DateTimePicker from '@/components/ui/date-time-picker';
import useScrollLock from '@/hooks/useScrollLock';
import { getTaskDurationMinutes } from '@/lib/calendarUtils';
import { formatTimeOnly, NEW_TASK_ID } from '@/lib/calendarPageHelpers';
import { TASK_TITLE_MAX_LENGTH } from '@/lib/utils';

const CalendarModals = ({
  activeModal,
  setActiveModal,
  previewTask,
  previewMergedEntries,
  allTasks,
  locale,
  language,
  t,
  formatText,
  noteInput,
  setNoteInput,
  notesReady,
  noteMutation,
  handleSaveNote,
  handleDeleteNote,
  deleteCalendarTaskMutation,
  selectionActionMutation,
  handleUnmergeTask,
  openTaskScheduleModal,
  scheduleTaskSelectId,
  scheduleStartTimeId,
  scheduleDeadlineId,
  scheduleNewTitleId,
  taskScheduleForm,
  setTaskScheduleForm,
  handleScheduleTaskChange,
  selectedScheduleTask,
  handleClearSchedule,
  handleSaveSchedule,
  scheduleMutation,
}) => {
  useScrollLock(Boolean(activeModal));

  return (
    <AnimatePresence>
    {activeModal ? (
      <div
        className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6'
        role='presentation'
        onClick={() => setActiveModal(null)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className='flex h-[min(400px,90vh)] w-[min(540px,94vw)] flex-col overflow-hidden rounded-3xl border border-white/80 bg-[linear-gradient(145deg,#ffffff,#f8faff)] shadow-2xl dark:border-white/20 dark:bg-[linear-gradient(145deg,#1b2438,#151e33)]'
        >
          <header className='flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-600'>
            <div className='min-w-0 flex-1'>
              <h3 className='truncate text-base font-extrabold text-slate-900 dark:text-white'>
                {activeModal.mode === 'preview' && previewTask
                  ? previewTask.title
                  : activeModal.date
                  ? new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(activeModal.date)
                  : t.calendarTitle}
              </h3>
              <p className='text-xs text-slate-400'>
                {activeModal.mode === 'preview'
                  ? t.taskPreview || (language === 'vi' ? 'Xem trước công việc' : 'Task preview')
                  : activeModal.mode === 'note'
                  ? language === 'vi'
                    ? 'Ghi chú cho ngày này'
                    : 'Day Note'
                  : language === 'vi'
                  ? 'Lên lịch công việc vào khung giờ'
                  : 'Schedule task time block'}
              </p>
            </div>

            <div className='flex shrink-0 items-center gap-1.5'>
              {activeModal.mode !== 'preview' ? (
                <div className='flex rounded-3xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-500 dark:bg-slate-800'>
                  <button
                    type='button'
                    onClick={() => setActiveModal((prev) => ({ ...prev, mode: 'note' }))}
                    className={`rounded-3xl px-3 py-1 text-xs font-bold transition ${
                      activeModal.mode === 'note'
                        ? 'bg-white text-violet-700 shadow-xs dark:bg-violet-600 dark:text-white'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                    }`}
                  >
                    📝 {language === 'vi' ? 'Ghi chú' : 'Note'}
                  </button>
                  <button
                    type='button'
                    onClick={() => setActiveModal((prev) => ({ ...prev, mode: 'task' }))}
                    className={`rounded-3xl px-3 py-1 text-xs font-bold transition ${
                      activeModal.mode === 'task'
                        ? 'bg-white text-violet-700 shadow-xs dark:bg-violet-600 dark:text-white'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                    }`}
                  >
                    ⏱️ {language === 'vi' ? 'Lịch hẹn' : 'Task'}
                  </button>
                </div>
              ) : null}

              <button
                type='button'
                onClick={() => setActiveModal(null)}
                className='flex h-8 w-8 items-center justify-center rounded-3xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                aria-label={t.close}
              >
                <X className='h-4 w-4' />
              </button>
            </div>
          </header>

          <div className='flex flex-1 flex-col overflow-y-auto p-6'>
            {activeModal.mode === 'preview' && previewTask ? (
              <div className='flex h-full flex-col gap-4'>
                <div className='flex flex-wrap items-center gap-1.5'>
                  <span
                    className={`rounded-3xl px-2.5 py-1 text-[10px] font-bold ${
                      previewTask.status === 'complete'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                    }`}
                  >
                    {previewTask.status === 'complete'
                      ? t.completed || 'Completed'
                      : t.taskInProgress || (language === 'vi' ? 'Đang thực hiện' : 'In progress')}
                  </span>
                  {previewTask.important ? (
                    <span className='rounded-3xl bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'>
                      {t.important || 'Important'}
                    </span>
                  ) : null}
                  {previewTask.startAt ? (
                    <span className='flex items-center gap-1 rounded-3xl bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300'>
                      <Clock className='h-3 w-3 shrink-0' />
                      {formatTimeOnly(previewTask.startAt, locale)}
                      {previewTask.dueAt ? ` – ${formatTimeOnly(previewTask.dueAt, locale)}` : ''}
                    </span>
                  ) : null}
                  {previewTask.estimatedMinutes ? (
                    <span className='rounded-3xl bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300'>
                      {previewTask.estimatedMinutes}m
                    </span>
                  ) : null}
                </div>

                {previewMergedEntries.length >= 2 ? (
                  <div className='scrollable-content flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1'>
                    <p className='text-xs font-bold text-slate-600 dark:text-slate-300'>
                      {t.mergedTasksTitle || (language === 'vi' ? 'Các công việc đã gộp' : 'Merged tasks')} ({previewMergedEntries.length})
                    </p>
                    {previewMergedEntries.map((entry, index) => {
                      const liveEntry = allTasks.find((task) => task._id === entry.taskId);
                      const entryTitle = liveEntry?.title
                        || entry.title
                        || (entry.occurrenceId
                          ? formatText('occurrenceLabel', { count: index + 1 })
                          : t.untitled || 'Task');
                      return (
                        <div
                          key={`${entry.taskId}-${index}`}
                          className='rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-500 dark:bg-slate-800'
                        >
                          <div className='flex items-center gap-2'>
                            <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-3xl bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'>
                              {index + 1}
                            </span>
                            <p className='min-w-0 flex-1 truncate text-xs font-bold text-slate-800 dark:text-slate-100' title={entryTitle}>
                              {entryTitle}
                            </p>
                            {liveEntry?.status === 'complete' ? (
                              <span className='shrink-0 rounded-3xl bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'>
                                ✓ {t.completed || 'Completed'}
                              </span>
                            ) : null}
                          </div>
                          <p className='mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400'>
                            <Clock className='h-3 w-3 shrink-0' />
                            <span className='truncate'>
                              {entry.startAt
                                ? `${formatTimeOnly(entry.startAt, locale)}${entry.dueAt ? ` – ${formatTimeOnly(entry.dueAt, locale)}` : ''}`
                                : t.taskUnscheduled || (language === 'vi' ? 'Chưa lên lịch' : 'Unscheduled')}
                            </span>
                          </p>
                          {liveEntry?.content ? (
                            <p className='mt-1.5 line-clamp-3 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-500 dark:text-slate-400'>
                              {liveEntry.content}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className='flex min-h-0 flex-1 flex-col gap-1.5'>
                    <p className='text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
                      {t.taskNote || (language === 'vi' ? 'Ghi chú' : 'Note')}
                    </p>
                    <div className='scrollable-content min-h-0 flex-1 whitespace-pre-wrap break-words rounded-3xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-700 shadow-inner dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'>
                      {previewTask.content ? (
                        previewTask.content
                      ) : (
                        <span className='italic text-slate-400 dark:text-slate-500'>
                          {t.noTaskContent || (language === 'vi' ? 'Không có ghi chú.' : 'No note.')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className='mt-auto flex items-center justify-between gap-2 pt-2'>
                  <div className='flex items-center gap-1'>
                    {previewTask.startAt && getTaskDurationMinutes(previewTask) > 60 ? (
                      <button
                        type='button'
                        onClick={() => handleUnmergeTask(previewTask)}
                        disabled={selectionActionMutation.isPending}
                        className='flex items-center gap-1.5 rounded-3xl px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-900/30'
                      >
                        <Split className='h-4 w-4' />
                        {t.unmergeTasks || 'Bỏ gộp'}
                      </button>
                    ) : null}
                    <button
                      type='button'
                      onClick={() => deleteCalendarTaskMutation.mutate({
                        taskId: previewTask._id,
                        occurrenceId: previewTask.calendarOccurrenceId,
                        date: activeModal.date,
                        task: previewTask,
                      })}
                      disabled={deleteCalendarTaskMutation.isPending}
                      className='flex items-center gap-1.5 rounded-3xl px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-900/30'
                    >
                      <Trash2 className='h-4 w-4' />
                      {previewTask.calendarOccurrenceId
                        && previewTask.calendarOccurrenceId !== 'primary'
                        && !previewTask.createdFromCalendar
                        ? t.deleteCalendarOccurrence
                        : previewTask.createdFromCalendar
                          ? t.deleteTask
                          : t.deleteCalendarOccurrence}
                    </button>
                  </div>

                  <div className='flex items-center gap-2'>
                    <button
                      type='button'
                      onClick={() => openTaskScheduleModal(activeModal.date, previewTask)}
                      className='flex items-center gap-1.5 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-violet-600/30 transition hover:from-violet-700 hover:to-indigo-700 active:scale-95'
                    >
                      <CalendarClock className='h-3.5 w-3.5' />
                      {t.editSchedule || (language === 'vi' ? 'Chỉnh sửa lịch' : 'Edit schedule')}
                    </button>
                  </div>
                </div>
              </div>
            ) : activeModal.mode === 'note' ? (
              <form onSubmit={handleSaveNote} className='flex h-full flex-col gap-4'>
                <div className='relative flex-1'>
                  <label htmlFor='modal-day-note-input' className='sr-only'>
                    {t.dayNote}
                  </label>
                  <textarea
                    id='modal-day-note-input'
                    autoFocus
                    rows={6}
                    maxLength={4000}
                    value={noteInput}
                    disabled={!notesReady || noteMutation.isPending}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder={
                      t.dayNotePlaceholder ||
                      (language === 'vi'
                        ? 'Viết ghi chú quan trọng, nhắc nhở hoặc nhật ký công việc cho ngày này...'
                        : 'Add a private note or log for this day…')
                    }
                    className='h-full min-h-32 w-full resize-none rounded-3xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-800 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-violet-900/30'
                  />
                  <span className='absolute bottom-3 right-4 text-[10px] text-slate-400'>
                    {noteInput.length} / 4000
                  </span>
                </div>

                <div className='flex items-center justify-between pt-2'>
                  {noteInput ? (
                    <button
                      type='button'
                      onClick={handleDeleteNote}
                      disabled={!notesReady || noteMutation.isPending}
                      className='flex items-center gap-1 rounded-3xl px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-900/30'
                    >
                      <Trash2 className='h-4 w-4' />
                      <span>{language === 'vi' ? 'Xóa ghi chú' : 'Delete note'}</span>
                    </button>
                  ) : <div />}

                  <div className='flex items-center gap-2'>
                    <button
                      type='button'
                      onClick={() => setActiveModal(null)}
                      className='rounded-3xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300'
                    >
                      {t.close}
                    </button>
                    <button
                      type='submit'
                      disabled={!notesReady || noteMutation.isPending}
                      className='rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-violet-600/30 transition hover:from-violet-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50'
                    >
                      {noteMutation.isPending
                        ? t.loading
                        : language === 'vi'
                        ? 'Lưu ghi chú'
                        : 'Save note'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveSchedule} className='flex h-full flex-col gap-4'>
                <div>
                  <label htmlFor={scheduleTaskSelectId} className='mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300'>
                    {t.selectTask}
                  </label>
                  <SelectMenu
                    id={scheduleTaskSelectId}
                    value={taskScheduleForm.taskId}
                    onChange={handleScheduleTaskChange}
                    ariaLabel={t.selectTask}
                    placeholder={t.selectTaskPlaceholder}
                    options={[
                      { value: NEW_TASK_ID, label: t.createNewTaskOption },
                      ...allTasks.map((task) => ({
                        value: task._id,
                        label: `${task.title}${task.status === 'complete' ? ' ✓' : ''}`,
                      })),
                    ]}
                    className='h-10 w-full px-3 text-xs shadow-sm'
                  />
                </div>

                {taskScheduleForm.taskId === NEW_TASK_ID ? (
                  <div>
                    <label htmlFor={scheduleNewTitleId} className='mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300'>
                      {t.newTaskTitle}
                    </label>
                    <input
                      id={scheduleNewTitleId}
                      type='text'
                      maxLength={TASK_TITLE_MAX_LENGTH}
                      autoFocus={activeModal.focusNewTaskTitle}
                      value={taskScheduleForm.newTitle}
                      onChange={(e) =>
                        setTaskScheduleForm((prev) => ({ ...prev, newTitle: e.target.value }))
                      }
                      placeholder={t.newTaskTitlePlaceholder}
                      className='h-10 w-full rounded-3xl border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-violet-900/30'
                    />
                  </div>
                ) : null}

                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <label htmlFor={scheduleStartTimeId} className='mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300'>
                      {t.startTime}
                    </label>
                    <DateTimePicker
                      id={scheduleStartTimeId}
                      value={taskScheduleForm.startAt}
                      onChange={(nextValue) =>
                        setTaskScheduleForm((prev) => ({ ...prev, startAt: nextValue }))
                      }
                      ariaLabel={t.startTime}
                      placeholder={t.startTime}
                      className='shadow-sm'
                    />
                  </div>

                  <div>
                    <label htmlFor={scheduleDeadlineId} className='mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300'>
                      {t.dueDate}
                    </label>
                    <DateTimePicker
                      id={scheduleDeadlineId}
                      value={taskScheduleForm.dueAt}
                      onChange={(nextValue) =>
                        setTaskScheduleForm((prev) => ({ ...prev, dueAt: nextValue }))
                      }
                      ariaLabel={t.dueDate}
                      placeholder={t.dueDate}
                      className='shadow-sm'
                    />
                  </div>
                </div>

                <div className='mt-auto flex items-center justify-between pt-2'>
                  {(selectedScheduleTask?.startAt
                    || selectedScheduleTask?.dueAt
                    || (activeModal?.task?.calendarOccurrenceId
                      && activeModal.task.calendarOccurrenceId !== 'primary')) ? (
                    <button
                      type='button'
                      onClick={handleClearSchedule}
                      disabled={scheduleMutation.isPending}
                      className='rounded-3xl px-3 py-2 text-xs font-bold text-slate-500 hover:text-rose-600'
                    >
                      {t.clearSchedule}
                    </button>
                  ) : <div />}

                  <div className='flex items-center gap-2'>
                    <button
                      type='button'
                      onClick={() => setActiveModal(null)}
                      className='rounded-3xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300'
                    >
                      {t.close}
                    </button>
                    <button
                      type='submit'
                      disabled={scheduleMutation.isPending}
                      className='rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-violet-600/30 transition hover:from-violet-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50'
                    >
                      {scheduleMutation.isPending
                        ? t.loading
                        : t.saveSchedule}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    ) : null}
    </AnimatePresence>
  );
};

export default CalendarModals;
