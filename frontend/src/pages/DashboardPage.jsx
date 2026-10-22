import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, ListTodo } from 'lucide-react';
import { LayoutShell } from '@/components/LayoutShell';
import Header from '@/components/Header';
import { fetchProductivityAnalytics } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { buildDailyAnalyticsBuckets } from '@/lib/analyticsUtils';

const DashboardPage = () => {
  const { t, language } = useLanguage();
  const [range, setRange] = useState('7d');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const query = useQuery({
    queryKey: ['productivityAnalytics', range, timeZone],
    queryFn: async () => (await fetchProductivityAnalytics(range, timeZone)).data,
    staleTime: 60 * 1000,
  });

  const data = query.data;
  const buckets = useMemo(() => data ? buildDailyAnalyticsBuckets(data, timeZone) : [], [data, timeZone]);
  const maxValue = Math.max(1, ...buckets.flatMap(({ created, completed }) => [created, completed]));
  const numberFormat = new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US');
  const dayLabel = (key) => new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${key}T12:00:00.000Z`));
  const showEveryLabel = buckets.length <= 14 ? 1 : Math.ceil(buckets.length / 10);
  const hasData = Boolean(data?.summary?.total || buckets.some(({ created, completed }) => created || completed));

  return (
    <LayoutShell>
      <div className='space-y-5'>
        <Header />
        <header className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div className='flex items-center gap-3'>
            <BarChart3 className='h-7 w-7 text-violet-600' />
            <div>
              <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>{t.productivityDashboard}</h1>
            </div>
          </div>
          <div className='relative grid grid-cols-3 gap-1 rounded-3xl border border-slate-200/80 bg-slate-100/90 p-1 shadow-inner dark:border-slate-700 dark:bg-slate-950/70' role='group' aria-label={t.analyticsRange}>
            <span className='pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-1rem)/3)] rounded-3xl bg-violet-600 shadow-accent-indicator transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]' style={{ transform: `translateX(calc(${['7d', '30d', '90d'].indexOf(range) * 100}% + ${['7d', '30d', '90d'].indexOf(range) * 4}px))` }} />
            {[
              ['7d', t.last7Days],
              ['30d', t.last30Days],
              ['90d', t.last90Days],
            ].map(([key, label]) => (
              <button key={key} type='button' aria-pressed={range === key} onClick={() => setRange(key)} className={`relative z-10 rounded-3xl px-3 py-1.5 text-xs font-semibold transition-colors ${range === key ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                {label}
              </button>
            ))}
          </div>
        </header>

        {query.isLoading ? (
          <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
            {Array.from({ length: 4 }, (_, index) => <div key={index} className='h-24 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800' />)}
          </div>
        ) : query.isError ? (
          <section role='alert' className='rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'>
            <p>{t.analyticsLoadError}</p>
            <button type='button' onClick={() => query.refetch()} className='mt-3 font-semibold underline'>{t.retry}</button>
          </section>
        ) : !hasData ? (
          <section className='flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 p-8 text-center shadow-md dark:border-slate-700 dark:bg-slate-900/50'>
            <BarChart3 className='mb-3 h-8 w-8 text-slate-400' />
            <p className='font-medium text-slate-700 dark:text-slate-200'>{t.analyticsEmptyTitle}</p>
            <p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>{t.analyticsEmptyDescription}</p>
          </section>
        ) : (
          <>
            <section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
              {[
                { label: t.totalTasks, value: data.summary.total, Icon: ListTodo, tone: 'violet' },
                { label: t.statusPending, value: data.summary.pending, Icon: Clock3, tone: 'sky' },
                { label: t.statusCompleted, value: data.summary.completed, Icon: CheckCircle2, tone: 'emerald' },
                { label: t.overdueTasks, value: data.summary.overdue, Icon: AlertTriangle, tone: 'rose' },
              ].map(({ label, value, Icon, tone }) => (
                <article key={label} className='flex items-center gap-3 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-md dark:border-slate-800 dark:bg-slate-900/70'>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-3xl ${tone === 'violet' ? 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200' : tone === 'sky' ? 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-200' : tone === 'emerald' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-200'}`}>
                    <Icon className='h-5 w-5' />
                  </span>
                  <div>
                    <p className='text-xl font-bold text-slate-900 dark:text-white'>{numberFormat.format(value)}</p>
                    <p className='text-xs text-slate-500 dark:text-slate-400'>{label}</p>
                  </div>
                </article>
              ))}
            </section>

            <section className='grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]'>
              <article className='min-w-0 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-md dark:border-slate-800 dark:bg-slate-900/70 sm:p-5'>
                <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
                  <div>
                    <h2 className='font-semibold text-slate-900 dark:text-white'>{t.taskActivity}</h2>
                    <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>{t.dailyCreatedCompleted}</p>
                  </div>
                  <div className='flex gap-3 text-xs text-slate-600 dark:text-slate-300'>
                    <span className='flex items-center gap-1.5'><i className='h-2.5 w-2.5 rounded-3xl bg-sky-500' />{t.createdLabel}</span>
                    <span className='flex items-center gap-1.5'><i className='h-2.5 w-2.5 rounded-3xl bg-emerald-500' />{t.completedLabel}</span>
                  </div>
                </div>
                <div className='overflow-x-auto pb-2'>
                  <div className='flex h-48 min-w-full items-end gap-1 border-b border-slate-200 dark:border-slate-700' style={{ minWidth: `${Math.max(100, buckets.length * 30)}px` }}>
                    {buckets.map(({ key, created, completed }, index) => (
                      <div key={key} className='flex h-full min-w-0 flex-1 flex-col justify-end'>
                        <div className='flex h-[calc(100%-1.5rem)] items-end justify-center gap-0.5' title={`${dayLabel(key)}: ${created} ${t.createdLabel}, ${completed} ${t.completedLabel}`}>
                          <div className='w-1/2 max-w-3 rounded-3xl bg-sky-500/85' style={{ height: `${created ? Math.max(4, created / maxValue * 100) : 0}%` }} />
                          <div className='w-1/2 max-w-3 rounded-3xl bg-emerald-500/85' style={{ height: `${completed ? Math.max(4, completed / maxValue * 100) : 0}%` }} />
                        </div>
                        <span className='h-6 truncate pt-1 text-center text-xs text-slate-500 dark:text-slate-400'>
                          {index % showEveryLabel === 0 || index === buckets.length - 1 ? dayLabel(key) : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              <article className='rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-md dark:border-slate-800 dark:bg-slate-900/70 sm:p-5'>
                <h2 className='font-semibold text-slate-900 dark:text-white'>{t.completionRate}</h2>
                <div className='mt-5 flex items-end gap-2'>
                  <p className='text-4xl font-bold text-slate-900 dark:text-white'>{data.summary.completionRate}%</p>
                  <p className='pb-1 text-xs text-slate-500 dark:text-slate-400'>{t.allTasks}</p>
                </div>
                <div className='mt-3 h-2 overflow-hidden rounded-3xl bg-slate-100 dark:bg-slate-800'>
                  <div className='h-full rounded-3xl bg-emerald-500 transition-[width]' style={{ width: `${data.summary.completionRate}%` }} />
                </div>
                <div className='mt-6 border-t border-slate-200 pt-4 dark:border-slate-800'>
                  <h3 className='text-sm font-medium text-slate-800 dark:text-slate-200'>{t.estimatedVsActual}</h3>
                  {data.duration.tasks ? (
                    <div className='mt-3 grid grid-cols-2 gap-3'>
                      <div><p className='text-lg font-semibold text-slate-900 dark:text-white'>{numberFormat.format(data.duration.estimatedMinutes)} {t.minutes}</p><p className='text-xs text-slate-500 dark:text-slate-400'>{t.estimated}</p></div>
                      <div><p className='text-lg font-semibold text-slate-900 dark:text-white'>{numberFormat.format(Math.round(data.duration.actualSeconds / 60))} {t.minutes}</p><p className='text-xs text-slate-500 dark:text-slate-400'>{t.actual}</p></div>
                    </div>
                  ) : <p className='mt-2 text-xs text-slate-500 dark:text-slate-400'>{t.noDurationData}</p>}
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </LayoutShell>
  );
};

export default DashboardPage;
