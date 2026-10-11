import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { keepTextareaContentVisible } from '@/lib/textareaSizing';

const AddTask = ({ onAdd, contentType = 'task' }) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [startAt, setStartAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextTitle = title.trim();

    if (!nextTitle || !onAdd) return;

    const schedule = {};
    if (startAt) schedule.startAt = new Date(startAt).toISOString();
    if (dueAt) schedule.dueAt = new Date(dueAt).toISOString();
    if (estimatedMinutes) schedule.estimatedMinutes = Number(estimatedMinutes);
    if (Object.keys(schedule).length) {
      schedule.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    onAdd({
      title: nextTitle,
      contentType,
      content: contentType === 'note' ? content.trim() : '',
      items: contentType === 'list'
        ? content.split('\n').map((item) => item.trim()).filter(Boolean)
        : [],
      ...schedule,
    });
    setTitle('');
    setContent('');
    setStartAt('');
    setDueAt('');
    setEstimatedMinutes('');
  };

  const handleContentChange = (event) => {
    const textarea = event.currentTarget;
    const nextContent = textarea.value;
    setContent(nextContent);

    keepTextareaContentVisible(textarea);
  };

  const isDisable = !title.trim() || (contentType !== 'task' && !content.trim());
  const invalidScheduleRange = startAt && dueAt && new Date(dueAt) < new Date(startAt);
  const titleInput = (
    <Input
      id='new-task-title'
      type='text'
      value={title}
      onChange={(event) => setTitle(event.target.value)}
      placeholder={contentType === 'note' ? t.noteTitle : contentType === 'list' ? t.listTitle : t.addNewTask}
      className='h-12 rounded-2xl border-slate-200 bg-slate-50 text-base text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-violet-900/40 sm:flex-1'
    />
  );
  const submitButton = (
    <button
      type='submit'
      disabled={isDisable || invalidScheduleRange}
      title={t.newTaskShortcut}
      className={`group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-2xl px-6 text-sm font-semibold text-white transition-all duration-300 ${
        isDisable || invalidScheduleRange
          ? 'cursor-not-allowed bg-violet-500/40 opacity-50 dark:bg-violet-600/30'
          : 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-accent active:scale-95 hover:-translate-y-0.5 hover:from-violet-500 hover:to-indigo-500 hover:shadow-accent-strong '
      }`}
    >
      <Plus className={`h-4 w-4 transition-transform duration-300 ${!isDisable ? 'group-hover:rotate-90' : ''}`} />
      <span>{contentType === 'note' ? t.newNote : contentType === 'list' ? t.newList : t.newTask}</span>
    </button>
  );

  return (
    <Card className='rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70'>
      <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
        {contentType === 'list' ? titleInput : (
          <div className='flex flex-col gap-3 sm:flex-row'>
            {titleInput}
            {submitButton}
          </div>
        )}
        {contentType !== 'task' ? (
          <textarea
            value={content}
            onChange={handleContentChange}
            placeholder={contentType === 'note' ? t.noteContent : t.listItems}
            rows={contentType === 'note' ? 5 : Math.max(4, content.split('\n').length)}
            className='w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-violet-900/40'
          />
        ) : null}
        {contentType === 'list' ? <div className='flex justify-end'>{submitButton}</div> : null}
        {contentType === 'task' ? (
          <details className='rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700'>
            <summary className='cursor-pointer font-medium text-slate-600 dark:text-slate-300'>
              {t.scheduleTask}
            </summary>
            <div className='mt-3 grid gap-3 sm:grid-cols-3'>
              <label className='grid gap-1 text-xs text-slate-500 dark:text-slate-400'>
                {t.startTime}
                <input type='datetime-local' value={startAt} onChange={(event) => setStartAt(event.target.value)} className='h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100' />
              </label>
              <label className='grid gap-1 text-xs text-slate-500 dark:text-slate-400'>
                {t.dueDate}
                <input type='datetime-local' value={dueAt} onChange={(event) => setDueAt(event.target.value)} className='h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100' />
              </label>
              <label className='grid gap-1 text-xs text-slate-500 dark:text-slate-400'>
                {t.estimatedDuration}
                <input type='number' min='1' max='1440' step='1' value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(event.target.value)} placeholder='30' className='h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100' />
              </label>
            </div>
          </details>
        ) : null}
        {invalidScheduleRange ? <p className='text-xs font-medium text-rose-600 dark:text-rose-300'>{t.invalidScheduleRange}</p> : null}
      </form>
    </Card>
  );
};

export default AddTask;
