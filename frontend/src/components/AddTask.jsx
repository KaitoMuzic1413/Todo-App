import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Card } from './ui/card';
import { Input } from './ui/input';

const AddTask = ({ onAdd }) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');

  const isInputEmpty = !title.trim();

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextTitle = title.trim();

    if (!nextTitle || !onAdd) return;

    onAdd(nextTitle);
    setTitle('');
  };

  return (
    <Card className='rounded-[28px] border border-slate-200/80 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70'>
      <form onSubmit={handleSubmit} className='flex flex-col gap-3 sm:flex-row'>
        <Input
          type='text'
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t.addNewTask}
          className='h-12 rounded-2xl border-slate-200 bg-slate-50 text-base text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-violet-900/40 sm:flex-1'
        />

        <button
          type='submit'
          disabled={isInputEmpty}
          className='inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 px-6 text-sm font-semibold text-white shadow-md shadow-violet-200 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 dark:shadow-violet-900/30'
        >
          <Plus className='h-4 w-4' />
          {t.newTask}
        </button>
      </form>
    </Card>
  );
};

export default AddTask;