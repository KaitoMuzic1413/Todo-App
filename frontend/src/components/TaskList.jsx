import { Check, CheckCircle2, Circle, Star, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/i18n';

const MAX_TASKS_PER_PAGE = 5;

const formatTaskCreatedAt = (value, language) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';
  return date.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

const taskItemVariants = {
  initial: { opacity: 0, y: 30, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, x: -60, scale: 0.95 },
};

const TaskList = ({
  title,
  tasks = [],
  page = 1,
  dateFilter = 'all',
  onToggle,
  onDelete,
  onUpdate,
  onDeleteMany,
}) => {
  const { t, language } = useLanguage();
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [draftValue, setDraftValue] = useState('');

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  const [prevPage, setPrevPage] = useState(page);
  const [direction, setDirection] = useState(1);

  if (prevPage !== page) {
    setDirection(page >= prevPage ? 1 : -1);
    setPrevPage(page);
  }

  const emptySlotsCount = Math.max(0, MAX_TASKS_PER_PAGE - tasks.length);

  const startEditing = (task) => {
    setEditingTaskId(task._id);
    setDraftValue(task.title);
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setDraftValue('');
  };

  const saveEditing = async (taskId) => {
    const nextTitle = draftValue.trim();
    if (!nextTitle) return;

    await onUpdate?.(taskId, nextTitle);
    cancelEditing();
  };

  const toggleImportant = async (task) => {
    await onUpdate?.(task._id, undefined, { important: !task.important });
  };

  const toggleSelectMode = () => {
    if (isSelectMode) {
      setIsSelectMode(false);
      setSelectedTaskIds([]);
    } else {
      setIsSelectMode(true);
      cancelEditing();
    }
  };

  const handleToggleSelectTask = (taskId) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTaskIds.length === tasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(tasks.map((task) => task._id));
    }
  };

  const handleConfirmDeleteSelected = async () => {
    if (selectedTaskIds.length === 0) return;

    if (onDeleteMany) {
      await onDeleteMany(selectedTaskIds);
    } else if (onDelete) {
      await Promise.all(selectedTaskIds.map((id) => onDelete(id)));
    }

    setSelectedTaskIds([]);
    setIsSelectMode(false);
  };

  const isAllSelected = tasks.length > 0 && selectedTaskIds.length === tasks.length;

  return (
    <div className='relative flex flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70'>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
        <h3 className='text-xl font-semibold text-slate-900 dark:text-white'>{title || t.todayTasks}</h3>

        <div className='flex items-center gap-2'>
          {isSelectMode ? (
            <>
              <button
                type='button'
                onClick={handleSelectAll}
                className='inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              >
                {isAllSelected ? (t.deselectAll || 'Bỏ chọn tất cả') : (t.selectAll || 'Chọn tất cả')}
              </button>

              <button
                type='button'
                onClick={handleConfirmDeleteSelected}
                disabled={selectedTaskIds.length === 0}
                className='inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50'
              >
                <Trash2 className='h-3.5 w-3.5' />
                {(t.deleteSelected || 'Xóa')} ({selectedTaskIds.length})
              </button>

              <button
                type='button'
                onClick={toggleSelectMode}
                className='flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                aria-label='Cancel batch selection'
              >
                <X className='h-4 w-4' />
              </button>
            </>
          ) : (
            <button
              type='button'
              onClick={toggleSelectMode}
              disabled={tasks.length === 0}
              className='inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-200'
              title='Quick remove task'
            >
              <Trash2 className='h-3.5 w-3.5' />
              {t.quickRemove || 'Xóa nhiều task'}
            </button>
          )}
        </div>
      </div>

      <div className='relative w-full overflow-hidden'>
        <AnimatePresence mode='wait' custom={direction}>
          <motion.div
            key={`${dateFilter}-${page}`}
            custom={direction}
            variants={slideVariants}
            initial='enter'
            animate='center'
            exit='exit'
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className='space-y-3 will-change-transform'
          >
            {tasks.length === 0 ? (
              <div className='flex h-[410px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300'>
                {t.noTasks}
              </div>
            ) : (
              <AnimatePresence mode='popLayout'>
                {tasks.map((task) => {
                  const done = task.status === 'complete';
                  const isEditing = editingTaskId === task._id;
                  const isSelected = selectedTaskIds.includes(task._id);
                  const createdDateStr = formatTaskCreatedAt(task.createdAt, language);

                  return (
                    <motion.div
                      key={task._id}
                      layout
                      variants={taskItemVariants}
                      initial='initial'
                      animate='animate'
                      exit='exit'
                      transition={{
                        layout: { type: 'spring', stiffness: 500, damping: 35 },
                        opacity: { duration: 0.2 },
                        y: { duration: 0.25 },
                      }}
                      onClick={() => isSelectMode && handleToggleSelectTask(task._id)}
                      className={`flex min-h-[72px] items-center justify-between gap-4 rounded-2xl border p-4 transition-colors will-change-transform ${
                        isSelectMode ? 'cursor-pointer hover:border-violet-300 dark:hover:border-violet-700' : ''
                      } ${
                        isSelected
                          ? 'border-violet-500 bg-violet-50/50 dark:border-violet-600 dark:bg-violet-950/20'
                          : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50'
                      }`}
                    >
                      <div className='flex min-w-0 flex-1 items-center gap-3'>
                        {!isSelectMode && (
                          <button
                            type='button'
                            onClick={() => onToggle?.(task._id)}
                            disabled={editingTaskId !== null}
                            className={`flex h-9 w-9 shrink-0 ${editingTaskId !== null ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition-transform dark:bg-slate-900`}
                            aria-label={done ? 'Mark task as active' : 'Mark task as complete'}
                          >
                            {done ? (
                              <CheckCircle2 className='h-4 w-4 text-emerald-500' />
                            ) : (
                              <Circle className='h-4 w-4 text-slate-400' />
                            )}
                          </button>
                        )}

                        <div className='min-w-0 flex-1'>
                          {isEditing ? (
                            <div className='flex items-center gap-2'>
                              <input
                                type='text'
                                value={draftValue}
                                onChange={(event) => setDraftValue(event.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    saveEditing(task._id);
                                  }
                                  if (e.key === 'Escape') {
                                    cancelEditing();
                                  }
                                }}
                                className='task-content min-w-0 flex-1 cursor-text rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-800 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                                autoFocus
                              />
                              <button
                                type='button'
                                onClick={() => saveEditing(task._id)}
                                className='cursor-pointer rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-medium text-white'
                              >
                                {t.save}
                              </button>
                              <button
                                type='button'
                                onClick={cancelEditing}
                                className='cursor-pointer rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                              >
                                {t.cancel}
                              </button>
                            </div>
                          ) : (
                            <>
                              <p
                                className={`task-content truncate text-sm font-medium ${
                                  done ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'
                                }`}
                              >
                                {task.title}
                              </p>
                              {createdDateStr && (
                                <p className='mt-0.5 text-[11px] text-slate-400 dark:text-slate-400'>
                                  {t.createdAt || 'Created at'}: {createdDateStr}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className='flex shrink-0 items-center gap-2'>
                        {isSelectMode ? (
                          <button
                            type='button'
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSelectTask(task._id);
                            }}
                            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border transition-all ${
                              isSelected
                                ? 'border-violet-600 bg-violet-600 text-white'
                                : 'border-slate-300 bg-white text-transparent dark:border-slate-600 dark:bg-slate-900'
                            }`}
                            aria-label='Select task for deletion'
                          >
                            <Check className='h-4 w-4 stroke-[3]' />
                          </button>
                        ) : (
                          <>
                            <button
                              type='button'
                              onClick={() => toggleImportant(task)}
                              disabled={editingTaskId !== null}
                              className={`cursor-pointer rounded-full border px-2 py-1 text-xs font-medium transition-colors ${
                                task.important
                                  ? 'border-amber-300 bg-amber-50 text-amber-500 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-300'
                                  : 'border-slate-200 bg-white text-slate-400 hover:text-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-amber-400'
                              }`}
                              aria-label='Toggle important'
                            >
                              <Star className={`h-3.5 w-3.5 ${task.important ? 'fill-amber-400 text-amber-400 dark:fill-amber-300 dark:text-amber-300' : ''}`} />
                            </button>

                            <button
                              type='button'
                              onClick={() => (isEditing ? saveEditing(task._id) : startEditing(task))}
                              disabled={editingTaskId !== null && !isEditing}
                              className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium ${
                                editingTaskId !== null && !isEditing
                                  ? 'cursor-not-allowed border-slate-200/50 bg-slate-100 text-slate-400'
                                  : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                              }`}
                            >
                              {isEditing ? t.save : t.edit}
                            </button>

                            <button
                              type='button'
                              onClick={() => onDelete?.(task._id)}
                              disabled={editingTaskId !== null}
                              className={`flex h-8 w-8 ${
                                editingTaskId !== null ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                              } items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-500 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-200`}
                              aria-label='Delete task'
                            >
                              <Trash2 className='h-3.5 w-3.5' />
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {emptySlotsCount > 0 &&
                  Array.from({ length: emptySlotsCount }).map((_, index) => (
                    <motion.div
                      key={`empty-slot-${index}`}
                      layout
                      className='h-[72px] rounded-2xl border border-dashed border-slate-200/60 bg-slate-50/30 dark:border-slate-800/60 dark:bg-slate-950/20'
                    />
                  ))}
              </AnimatePresence>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TaskList;