import { AnimatePresence, motion } from 'framer-motion';
import useScrollLock from '@/hooks/useScrollLock';
import {
  CalendarClock,
  ClipboardPaste,
  Combine,
  Copy,
  Move,
  Scissors,
  Trash2,
} from 'lucide-react';

const SelectionMenu = ({
  cellMenu,
  selectionRect,
  menuRef,
  menuLeft,
  menuTop,
  selectionSummary,
  t,
  language,
  isFullDaySelection,
  canUnmergeSelection,
  mergeActionDisabled,
  canMoveTask,
  selectionTasksCount,
  onSelectFullDay,
  onMergeSelection,
  onStartMoveTask,
  onCopySelection,
  onCutSelection,
  onPasteSelection,
  onClearSelection,
}) => {
  useScrollLock(Boolean(cellMenu && selectionRect));

  const items = [
    {
      key: 'fullday',
      icon: CalendarClock,
      label: t.selectFullDay || 'Chọn cả ngày',
      disabled: isFullDaySelection,
      hint: t.fullDaySelected || 'Đã chọn trọn ngày rồi.',
      onClick: onSelectFullDay,
    },
    { key: 'divider-fullday', divider: true },
    {
      key: 'merge',
      icon: Combine,
      label: canUnmergeSelection
        ? t.unmergeCells || 'Bỏ gộp ô'
        : t.mergeAndCenter || 'Gộp ô & căn giữa',
      disabled: mergeActionDisabled,
      hint: t.mergeMultipleCellsOnly,
      onClick: onMergeSelection,
    },
    { key: 'divider-merge', divider: true },
    {
      key: 'move',
      icon: Move,
      label: t.moveTask || (language === 'vi' ? 'Di chuyển task' : 'Move task'),
      disabled: !canMoveTask,
      hint: t.moveTaskUnavailable
        || (language === 'vi'
          ? 'Chỉ có thể di chuyển khi vùng chọn chứa đúng 1 công việc bắt đầu trong ngày đã chọn.'
          : 'Move is available when the selection contains exactly one task that starts on the selected day.'),
      onClick: onStartMoveTask,
    },
    {
      key: 'copy',
      icon: Copy,
      label: t.copy,
      disabled: !selectionTasksCount,
      hint: t.selectionEmpty || 'Không có công việc trong vùng chọn',
      onClick: onCopySelection,
    },
    {
      key: 'cut',
      icon: Scissors,
      label: t.cutTasks,
      disabled: !selectionTasksCount,
      hint: t.selectionEmpty || 'Không có công việc trong vùng chọn',
      onClick: onCutSelection,
    },
    {
      key: 'paste',
      icon: ClipboardPaste,
      label: t.pasteTasks,
      onClick: onPasteSelection,
    },
    {
      key: 'clear',
      icon: Trash2,
      label: t.deleteTasks,
      disabled: !selectionTasksCount,
      hint: t.selectionEmpty,
      onClick: onClearSelection,
    },
    { key: 'divider-selection', divider: true },
  ];

  return (
    <AnimatePresence>
      {cellMenu && selectionRect ? (
        <motion.div
          ref={menuRef}
          onContextMenu={(event) => event.preventDefault()}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.12 }}
          style={{ left: `${menuLeft}px`, top: `${menuTop}px` }}
          className='fixed z-50 w-60 overflow-hidden rounded-3xl border border-slate-200 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-md dark:border-slate-500 dark:bg-slate-800/95'
          role='menu'
        >
          <p className='truncate px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500'>
            {selectionSummary}
          </p>

          {items.map((item) =>
            item.divider ? (
              <div
                key={item.key}
                className='mx-2 my-1 border-t border-slate-200/80 dark:border-slate-500/70'
              />
            ) : (
              <button
                key={item.key}
                type='button'
                role='menuitem'
                disabled={item.disabled}
                onClick={item.onClick}
                title={item.disabled ? item.hint : item.label}
                className={`flex w-full items-center gap-2.5 rounded-3xl px-3 py-2 text-xs font-semibold transition ${
                  item.disabled
                    ? 'cursor-not-allowed text-slate-400 dark:text-slate-600'
                    : 'cursor-pointer text-slate-700 hover:bg-violet-100/80 hover:text-violet-800 dark:text-slate-200 dark:hover:bg-violet-500/15 dark:hover:text-violet-200'
                }`}
              >
                <item.icon className='h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400' />
                <span className='truncate'>{item.label}</span>
              </button>
            )
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default SelectionMenu;
