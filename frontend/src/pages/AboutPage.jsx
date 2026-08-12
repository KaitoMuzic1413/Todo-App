import { Mail, MessageSquareText, Phone } from 'lucide-react';
import { LayoutShell, SidebarContactDetails } from '@/components/LayoutShell';
import Header from '@/components/Header';
import { useLanguage } from '@/lib/i18n';

const contactMethods = [
  {
    icon: Phone,
    label: 'Phone',
    value: '+84 123 456 789',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'hello@redhat.dev',
  },
  {
    icon: MessageSquareText,
    label: 'Facebook',
    value: 'fb.com/redhat',
  },
];

const AboutPage = () => {
  const { t } = useLanguage();

  return (
    <LayoutShell>
      <div className='space-y-8'>
        <Header />

        <section className='rounded-[32px] border border-slate-200/80 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70'>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
            <div>
              <p className='text-sm font-medium uppercase tracking-[0.22em] text-violet-500'>{t.aboutSubtitle}</p>
              <h2 className='mt-2 text-3xl font-bold text-slate-900 dark:text-white'>{t.aboutTitle}</h2>
            </div>
            <SidebarContactDetails />
          </div>

          <div className='mt-8 grid gap-4 md:grid-cols-3'>
            {contactMethods.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className='rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/50'
              >
                <div className='mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200'>
                  <Icon className='h-5 w-5' />
                </div>
                <p className='text-sm uppercase tracking-[0.18em] text-slate-400'>{label}</p>
                <p className='mt-2 text-lg font-semibold text-slate-900 dark:text-white'>{value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </LayoutShell>
  );
};

export default AboutPage;
