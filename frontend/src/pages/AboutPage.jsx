import { Globe, Mail, MessageSquareText, Phone } from 'lucide-react';
import Header from '@/components/Header';
import { LayoutShell } from '@/components/LayoutShell';
import { useLanguage } from '@/lib/i18n';

function ContactDetails() {
  return (
    <div className='flex flex-wrap items-center justify-center gap-3 text-sm text-slate-600 dark:text-slate-300'>
      <span className='inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60'>
        <Phone className='h-3.5 w-3.5 text-violet-500' />
        +84 793 903 870
      </span>
      <span className='inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60'>
        <Mail className='h-3.5 w-3.5 text-violet-500' />
        kaitomuzicvn@gmail.com
      </span>
      <a
        href='https://www.facebook.com/share/1KPgW9jyHm/'
        target='_blank'
        rel='noreferrer'
        className='inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 shadow-sm transition-colors hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:text-violet-200'
      >
        <Globe className='h-3.5 w-3.5 text-violet-500' />
        Kaito Dev
      </a>
    </div>
  );
}

const contactMethods = [
  {
    icon: Phone,
    label: 'Phone',
    value: '+84 793 903 870',
    href: 'tel:+84793903870',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'kaitomuzicvn@gmail.com',
    href: 'mailto:kaitomuzicvn@gmail.com',
  },
  {
    icon: MessageSquareText,
    label: 'Facebook',
    value: 'Kaito Dev',
    href: 'https://www.facebook.com/share/1KPgW9jyHm/',
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
              <p className='text-sm font-medium uppercase tracking-[0.22em] text-violet-500'>
                {t.aboutSubtitle}
              </p>
              <h2 className='mt-2 text-3xl font-bold text-slate-900 dark:text-white'>
                {t.aboutTitle}
              </h2>
            </div>
            
            <ContactDetails />
          </div>

          <div className='mt-8 grid gap-4 md:grid-cols-3'>
            {contactMethods.map(({ icon: Icon, label, value, href }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith('http') ? '_blank' : '_self'}
                rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className='block rounded-3xl border border-slate-200 bg-slate-50 p-5 transition-all hover:border-violet-300 hover:bg-violet-50/50 hover:shadow-md dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-violet-500/50 dark:hover:bg-slate-900/80'
              >
                <div className='mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200'>
                  <Icon className='h-5 w-5' />
                </div>
                <p className='text-sm uppercase tracking-[0.18em] text-slate-400'>{label}</p>
                <p 
                  className='mt-2 truncate text-lg font-semibold text-slate-900 dark:text-white'
                  title={value}
                >
                  {value}
                </p>
              </a>
            ))}
          </div>
        </section>
      </div>
    </LayoutShell>
  );
};

export default AboutPage;