import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Card } from './ui/card';
import { Input } from './ui/input';

const AddTask = ({ onAdd, contentType = 'task' }) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextTitle = title.trim();

    if (!nextTitle || !onAdd) return;

    onAdd({
      title: nextTitle,
      contentType,
      content: contentType === 'note' ? content.trim() : '',
      items: contentType === 'list'
        ? content.split('\n').map((item) => item.trim()).filter(Boolean)
        : [],
    });
    setTitle('');
    setContent('');
  };

  const isDisable = !title.trim() || (contentType !== 'task' && !content.trim());

  return (
    <Card className='rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70'>
      <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
        <div className='flex flex-col gap-3 sm:flex-row'>
        <Input
          type='text'
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={contentType === 'note' ? t.noteTitle : contentType === 'list' ? t.listTitle : t.addNewTask}
          className='h-12 rounded-2xl border-slate-200 bg-slate-50 text-base text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-violet-900/40 sm:flex-1'
        />

        <button
          type='submit'
          disabled={isDisable}
          className={`group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-2xl px-6 text-sm font-semibold text-white transition-all duration-300 ${
            isDisable
              ? 'cursor-not-allowed bg-violet-500/40 opacity-50 dark:bg-violet-600/30'
              : 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25 active:scale-95 hover:-translate-y-0.5 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/40 dark:shadow-violet-900/40'
          }`}
        >
          <Plus
            className={`h-4 w-4 transition-transform duration-300 ${
              !isDisable ? 'group-hover:rotate-90' : ''
            }`}
          />
          <span>{contentType === 'note' ? t.newNote : contentType === 'list' ? t.newList : t.newTask}</span>
        </button>
        </div>
        {contentType !== 'task' ? (
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={contentType === 'note' ? t.noteContent : t.listItems}
            rows={contentType === 'note' ? 5 : 4}
            className='w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-violet-900/40'
          />
        ) : null}
      </form>
    </Card>
  );
};

export default AddTask;