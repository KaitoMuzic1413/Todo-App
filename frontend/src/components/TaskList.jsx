import { Check, CheckCircle2, Circle, PencilLine, Star, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '@/lib/i18n';

const formatTaskCreatedAt = (value) => {
  if (!value) return 'Created recently';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Created recently';

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const TaskList = ({ title, tasks = [], onToggle, onDelete, onUpdate, onDeleteMany }) => {
  const { t } = useLanguage();
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [draftValue, setDraftValue] = useState('');

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

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
    <div className='rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70'>
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
                {isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>

              <button
                type='button'
                onClick={handleConfirmDeleteSelected}
                disabled={selectedTaskIds.length === 0}
                className='inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50'
              >
                <Trash2 className='h-3.5 w-3.5' />
                Xóa ({selectedTaskIds.length})
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
            <>
              <button
                type='button'
                onClick={toggleSelectMode}
                disabled={tasks.length === 0}
                className='inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-200'
                title='Chọn nhiều task để xóa'
              >
                <Trash2 className='h-3.5 w-3.5' />
                Quick remove task
              </button>
            </>
          )}
        </div>
      </div>

      <div className='space-y-3'>
        {tasks.length === 0 ? (
          <div className='rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300'>
            {t.noTasks}
          </div>
        ) : (
          tasks.map((task) => {
            const done = task.status === 'complete';
            const isEditing = editingTaskId === task._id;
            const isSelected = selectedTaskIds.includes(task._id);

            return (
              <div
                key={task._id}
                onClick={() => isSelectMode && handleToggleSelectTask(task._id)}
                className={`flex items-center justify-between gap-4 rounded-2xl border p-4 transition-colors ${
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
                      className={`flex h-9 w-9 ${editingTaskId !== null ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition-transform dark:bg-slate-900`}
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
                      <div className='flex flex-col gap-2'>
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
                          className='task-content min-w-0 cursor-text rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                          autoFocus
                        />
                        <div className='flex gap-2'>
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
                      </div>
                    ) : (
                      <>
                        <p
                          className={`task-content font-medium ${
                            done ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className='mt-1 text-[11px] text-slate-400 dark:text-slate-400'>
                          {formatTaskCreatedAt(task.createdAt)}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className='flex items-center gap-2'>
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
                    /* Chế độ thông thường */
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
                            ? 'border-slate-200/50 bg-slate-100 text-slate-400 cursor-not-allowed'
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TaskList;