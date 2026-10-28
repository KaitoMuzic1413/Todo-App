import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Crown, Gift, KeyRound, LoaderCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { LayoutShell } from '@/components/LayoutShell';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { fetchPremiumStatus, redeemPremiumInvite } from '@/lib/api';

const formatDate = (value) => {
  if (!value) return 'No expiry';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No expiry';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const QuotaBar = ({ label, used, limit }) => {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className='flex items-center justify-between gap-3 text-sm'>
        <span className='font-medium text-slate-700 dark:text-slate-200'>{label}</span>
        <span className='text-slate-500 dark:text-slate-400'>{used} / {limit}</span>
      </div>
      <div className='mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800'>
        <div className={`h-full rounded-full transition-[width] ${percent >= 100 ? 'bg-rose-500' : 'bg-violet-600'}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

const PremiumPage = () => {
  const [status, setStatus] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const { data } = await fetchPremiumStatus();
      setStatus(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load your premium status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadStatus(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const premiumActive = Boolean(status?.premiumActive);
  const planLabel = premiumActive ? 'Premium' : 'Free';
  const limits = status?.limits || { tasks: 100, attachments: 25 };
  const usage = status?.usage || { tasks: 0, attachments: 0 };
  const remainingLabel = useMemo(() => {
    if (!status) return '';
    return `${status.remaining.tasks} tasks and ${status.remaining.attachments} files remaining`;
  }, [status]);

  const handleRedeem = async (event) => {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;

    try {
      setRedeeming(true);
      const { data } = await redeemPremiumInvite(normalized);
      setStatus(data.premium);
      setCode('');
      toast.success(data.message || 'Premium activated successfully.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not redeem this invite code.');
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <LayoutShell>
      <div className='space-y-6'>
        <Header />

        <section className='overflow-hidden rounded-3xl bg-gradient-to-br from-[#1b1445] via-[#3b1d74] to-[#6d28d9] p-6 text-white shadow-[0_24px_64px_rgba(76,29,149,0.35)] sm:p-8'>
          <div className='flex flex-wrap items-start justify-between gap-5'>
            <div className='max-w-2xl'>
              <span className='inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-100'>
                <Crown className='h-3.5 w-3.5' /> {planLabel} plan
              </span>
              <h1 className='mt-4 text-3xl font-bold sm:text-4xl'>Do more with Kaito Premium</h1>
              <p className='mt-3 text-sm leading-6 text-violet-100 sm:text-base'>
                Higher task and file limits, invite-only access, and the same private workspace you already use.
              </p>
              {premiumActive ? (
                <p className='mt-4 inline-flex items-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm font-medium text-emerald-100'>
                  <CheckCircle2 className='h-4 w-4' /> Active until {formatDate(status?.premiumUntil)}
                </p>
              ) : (
                <p className='mt-4 text-sm text-violet-100'>Redeem an invite code below to activate Premium for 30 days.</p>
              )}
            </div>
            <div className='flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-white/20 bg-white/10'>
              <Sparkles className='h-10 w-10 text-amber-200' />
            </div>
          </div>
        </section>

        <div className='grid gap-5 lg:grid-cols-[1.15fr_0.85fr]'>
          <section className='rounded-3xl border border-slate-200/80 bg-white/85 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/75'>
            <div className='flex items-center gap-3'>
              <span className='flex h-10 w-10 items-center justify-center rounded-3xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200'><Crown className='h-5 w-5' /></span>
              <div>
                <h2 className='text-lg font-semibold text-slate-900 dark:text-white'>Your usage</h2>
                <p className='text-xs text-slate-500 dark:text-slate-400'>{remainingLabel}</p>
              </div>
            </div>

            {loading ? (
              <div className='mt-6 flex items-center gap-2 text-sm text-slate-500'><LoaderCircle className='h-4 w-4 animate-spin' /> Loading quotas...</div>
            ) : (
              <div className='mt-6 space-y-5'>
                <QuotaBar label='Tasks' used={usage.tasks} limit={limits.tasks} />
                <QuotaBar label='Files' used={usage.attachments} limit={limits.attachments} />
              </div>
            )}

            <div className='mt-6 grid gap-3 sm:grid-cols-2'>
              {[
                ['Task limit', `${limits.tasks} active tasks`],
                ['File limit', `${limits.attachments} archived files`],
                ['Premium duration', '30 days per invite'],
                ['Data ownership', 'Your tasks stay private'],
              ].map(([label, value]) => (
                <div key={label} className='rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/50'>
                  <p className='text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400'>{label}</p>
                  <p className='mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100'>{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className='rounded-3xl border border-slate-200/80 bg-white/85 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/75'>
            <div className='flex items-center gap-3'>
              <span className='flex h-10 w-10 items-center justify-center rounded-3xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-200'><Gift className='h-5 w-5' /></span>
              <h2 className='text-lg font-semibold text-slate-900 dark:text-white'>Redeem invite</h2>
            </div>
            <p className='mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300'>
              Enter the invite code from the administrator. Each code can only be used according to its usage limit.
            </p>
            <form onSubmit={handleRedeem} className='mt-5 space-y-3'>
              <label className='block text-sm font-medium text-slate-700 dark:text-slate-200' htmlFor='premium-invite-code'>
                Invite code
                <div className='relative mt-2'>
                  <KeyRound className='absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
                  <input
                    id='premium-invite-code'
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    placeholder='KAITO-XXXX-XXXX'
                    autoComplete='off'
                    className='h-12 w-full rounded-3xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold tracking-wider text-slate-800 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40'
                  />
                </div>
              </label>
              <button
                type='submit'
                disabled={redeeming || !code.trim()}
                className='inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60'
              >
                {redeeming ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Sparkles className='h-4 w-4' />}
                {redeeming ? 'Activating...' : 'Activate Premium'}
              </button>
            </form>
            <p className='mt-4 text-xs leading-5 text-slate-400'>
              Invite codes are single-use by default. Contact the administrator if your code has expired.
            </p>
          </section>
        </div>

        <Footer />
      </div>
    </LayoutShell>
  );
};

export default PremiumPage;
