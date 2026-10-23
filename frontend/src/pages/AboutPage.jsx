import { ArrowUpRight, Code2, Download, GraduationCap, Heart, Laptop2, Mail, MessageSquareText, Phone, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import { LayoutShell } from '@/components/LayoutShell';
import { useLanguage } from '@/lib/i18n';

const contactMethods = [
  { icon: Phone, label: 'Phone', value: '+84 793 903 870', href: 'tel:+84793903870' },
  { icon: Mail, label: 'Email', value: 'kaitomuzicvn@gmail.com', href: 'mailto:kaitomuzicvn@gmail.com' },
  { icon: MessageSquareText, label: 'Facebook', value: 'Kaito Dev', href: 'https://www.facebook.com/share/1KPgW9jyHm/' },
];

const skillGroups = [
  { key: 'languages', Icon: Code2, skills: ['C / C++', 'C# / .NET', 'Python', 'JavaScript'] },
  { key: 'frontend', Icon: Laptop2, skills: ['React', 'HTML / CSS'] },
  { key: 'tools', Icon: Terminal, skills: ['Linux', 'Git / GitHub'] },
];

const AboutPage = () => {
  const { t } = useLanguage();

  return (
    <LayoutShell hideAccountPanel={false}>
      <div className='space-y-8'>
        <Header />

        <section className='rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70'>
          <div>
            <p className='text-sm font-medium uppercase tracking-[0.22em] text-violet-500'>{t.aboutSubtitle}</p>
            <h2 className='mt-2 text-3xl font-bold text-slate-900 dark:text-white'>{t.aboutTitle}</h2>
          </div>

          <div className='mt-8 grid gap-4 md:grid-cols-3'>
            {contactMethods.map(({ icon: Icon, label, value, href }) => (
              <a key={label} href={href} target={href.startsWith('http') ? '_blank' : '_self'} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined} draggable={false} onDragStart={(event) => event.preventDefault()} className='block cursor-pointer select-none rounded-3xl border border-slate-200 bg-slate-50 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-violet-300 hover:bg-violet-50/50 hover:shadow-lg dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-violet-500/50 dark:hover:bg-slate-900/80 motion-reduce:transition-none'>
                <div className='mb-4 flex h-12 w-12 items-center justify-center rounded-3xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200'><Icon className='h-5 w-5' /></div>
                <p className='text-sm uppercase tracking-[0.18em] text-slate-400'>{label}</p>
                <p className='mt-2 truncate text-lg font-semibold text-slate-900 dark:text-white' title={value}>{value}</p>
              </a>
            ))}
          </div>
        </section>

        <section className='space-y-6 rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70 sm:space-y-7'>
          <div className='relative isolate overflow-hidden'>
            <div aria-hidden='true' className='pointer-events-none absolute -right-16 -top-24 -z-10 h-64 w-64 rounded-3xl bg-violet-200/40 blur-3xl dark:bg-violet-800/20' />
            <div className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:gap-6'>
              <div className='min-w-0'>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300'>{t.aboutEyebrow}</p>
                <h1 className='mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:mt-2 sm:text-4xl'>{t.aboutName}</h1>
                <p className='mt-1 text-sm font-medium text-violet-700 dark:text-violet-300 sm:mt-2 sm:text-base'>{t.aboutRole}</p>
              </div>
              <div className='h-20 w-20 shrink-0 overflow-hidden rounded-3xl border-4 border-white shadow-md dark:border-slate-800 sm:h-36 sm:w-36'>
                <img src='/Logo.jpg' alt='Kaito Dev logo' draggable={false} onDragStart={(event) => event.preventDefault()} className='h-full w-full select-none object-cover [-webkit-touch-callout:none]' />
              </div>
            </div>
            <p className='mt-5 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base'>{t.aboutIntro}</p>
          </div>

          <div className='grid gap-5 lg:grid-cols-[0.9fr_1.1fr]'>
            <section className='rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:p-6'>
              <div className='mb-5 flex items-center gap-3'>
                <span className='flex h-10 w-10 items-center justify-center rounded-3xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200'><GraduationCap className='h-5 w-5' aria-hidden='true' /></span>
                <h2 className='text-lg font-semibold text-slate-900 dark:text-white'>{t.aboutEducation}</h2>
              </div>
              <div className='rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70'>
                <h3 className='font-semibold text-slate-900 dark:text-white'>{t.aboutUniversity}</h3>
                <p className='mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300'>{t.aboutDegree}</p>
                <p className='mt-3 inline-flex rounded-3xl bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-200'>{t.aboutStudyPeriod}</p>
              </div>
            </section>

            <section className='rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:p-6'>
              <h2 className='mb-5 text-lg font-semibold text-slate-900 dark:text-white'>{t.aboutSkills}</h2>
              <div className='grid gap-4 sm:grid-cols-3'>
                {skillGroups.map(({ key, Icon, skills }) => (
                  <div key={key} className='rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70'>
                    <div className='mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100'><Icon className='h-4 w-4 text-violet-600 dark:text-violet-300' aria-hidden='true' />{t[`aboutSkill${key[0].toUpperCase()}${key.slice(1)}`]}</div>
                    <div className='flex flex-wrap gap-1.5'>{skills.map((skill) => <span key={skill} className='rounded-3xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'>{skill}</span>)}</div>
                  </div>
                ))}
              </div>
              <p className='mt-4 text-xs text-slate-500 dark:text-slate-400'>{t.aboutSkillsNote}</p>
            </section>
          </div>

          <section>
            <div className='mb-4 flex items-end justify-between gap-3'>
              <div><p className='text-xs font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300'>{t.aboutSelectedWork}</p><h2 className='mt-1 text-xl font-bold text-slate-900 dark:text-white'>{t.aboutProjects}</h2></div>
              <Code2 className='mb-1 h-5 w-5 text-slate-400' aria-hidden='true' />
            </div>
            <div className='grid gap-4 md:grid-cols-2 cursor-pointer'>
              <article className='group rounded-3xl border border-slate-200/80 bg-slate-50 p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-violet-300 hover:bg-violet-50/50 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-violet-700 dark:hover:bg-slate-900/80 sm:p-6 motion-reduce:transition-none'>
                <div className='flex items-start justify-between gap-3'><div><h3 className='text-lg font-semibold text-slate-900 dark:text-white'>Todo App</h3><p className='mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300'>{t.aboutTodoProjectDescription}</p></div><span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-3xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200'><Code2 className='h-5 w-5' aria-hidden='true' /></span></div>
                <div className='mt-4 flex flex-wrap gap-1.5'>{['React', 'Node.js'].map((tech) => <span key={tech} className='rounded-3xl bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300'>{tech}</span>)}</div>
                <a href='https://todo-app-seven-mocha-91.vercel.app/' target='_blank' rel='noopener noreferrer' className='mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 transition-colors hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100'>{t.aboutOpenDemo}<ArrowUpRight className='h-4 w-4' aria-hidden='true' /></a>
              </article>
              <article className='group rounded-3xl border border-slate-200/80 bg-slate-50 p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-violet-300 hover:bg-violet-50/50 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-violet-700 dark:hover:bg-slate-900/80 sm:p-6 motion-reduce:transition-none'>
                <div className='flex items-start justify-between gap-3'><div><h3 className='text-lg font-semibold text-slate-900 dark:text-white'>{t.aboutDesktopProject}</h3><p className='mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300'>{t.aboutDesktopProjectDescription}</p></div><span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-3xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'><Laptop2 className='h-5 w-5' aria-hidden='true' /></span></div>
                <div className='mt-4 flex flex-wrap gap-1.5'>{['React', 'Tauri', 'Remote API'].map((tech) => <span key={tech} className='rounded-3xl bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300'>{tech}</span>)}</div>
                <Link to='/download' className='mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 transition-colors hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100'>{t.desktopDownloadButton}<Download className='h-4 w-4' aria-hidden='true' /></Link>
              </article>
            </div>
          </section>

          <section className='flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:px-6'>
            <Heart className='h-5 w-5 shrink-0 text-rose-500' aria-hidden='true' />
            <div><h2 className='font-semibold text-slate-900 dark:text-white'>{t.aboutInterests}</h2><p className='mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300'>{t.aboutInterestsDescription}</p></div>
          </section>

          <footer className='border-t border-slate-200/80 pt-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400'>© 2026 Redhat Todo App</footer>
        </section>
      </div>
    </LayoutShell>
  );
};

export default AboutPage;
