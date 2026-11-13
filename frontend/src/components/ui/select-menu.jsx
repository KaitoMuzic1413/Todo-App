import { useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import AnchoredPopover from '@/components/ui/anchored-popover';
import { cn } from '@/lib/utils';

const SelectMenu = ({
  id,
  value,
  onChange,
  options = [],
  placeholder = '',
  ariaLabel,
  className,
  contentClassName,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const selected = options.find((option) => String(option.value) === String(value ?? ''));
  const selectOption = (nextValue) => {
    setOpen(false);
    onChange?.(nextValue);
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type='button'
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup='listbox'
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex items-center justify-between gap-1.5 rounded-3xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition hover:border-violet-300 focus-visible:border-violet-400 focus-visible:ring-4 focus-visible:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-violet-500/60 dark:focus-visible:ring-violet-900/30',
          className
        )}
      >
        <span className='truncate'>{selected?.label ?? placeholder}</span>
        <ChevronDown className='h-3.5 w-3.5 shrink-0 opacity-60' />
      </button>

      <AnchoredPopover
        open={open}
        onOpenChange={setOpen}
        triggerRef={triggerRef}
        matchTriggerWidth
        className={cn(
          'min-w-40 rounded-3xl bg-popover p-1.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10',
          contentClassName
        )}
      >
        <div role='listbox' aria-label={ariaLabel} className='flex max-h-64 flex-col gap-0.5 overflow-y-auto'>
          {options.map((option) => {
            const isSelected = String(option.value) === String(value ?? '');
            return (
              <button
                key={String(option.value)}
                type='button'
                role='option'
                aria-selected={isSelected}
                onClick={() => selectOption(option.value)}
                className={cn(
                  'flex min-h-8 w-full items-center gap-2 rounded-3xl px-2.5 py-1.5 text-left text-xs font-medium transition-colors',
                  isSelected
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                )}
              >
                <span className='min-w-0 flex-1 truncate'>{option.label}</span>
                {isSelected ? <Check className='h-3.5 w-3.5 shrink-0' /> : null}
              </button>
            );
          })}
        </div>
      </AnchoredPopover>
    </>
  );
};

export default SelectMenu;
