import { useEffect, useState } from 'react';
import { Copy, KeyRound, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { LayoutShell } from '@/components/LayoutShell';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLanguage } from '@/lib/i18n';
import { createPremiumInvite, deletePremiumInvite, fetchPremiumInvites } from '@/lib/api';

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('todo-user') || 'null');
  } catch {
    return null;
  }
};

const formatDate = (value) => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const InviteCreatePage = () => {
  const { t } = useLanguage();
  const [currentUser] = useState(getStoredUser);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ planDays: 30, maxUses: 1, expiresAt: '', code: '' });

  const loadInvites = async () => {
    try {
      setLoading(true);
      const { data } = await fetchPremiumInvites();
      setInvites(data.invites || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load invite codes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser?.isAdmin) return undefined;
    const timer = window.setTimeout(() => void loadInvites(), 0);
    return () => window.clearTimeout(timer);
  }, [currentUser?.isAdmin]);

  if (!currentUser?.isAdmin) {
    return (
      <LayoutShell>
        <div className='space-y-6'>
          <Header />
          <div className='rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-200'>
            Administrator access is required to create premium invite codes.
          </div>
          <Footer />
        </div>
      </LayoutShell>
    );
  }

  const handleCreate = async (event) => {
    event.preventDefault();
    try {
      setCreating(true);
      const payload = {
        planDays: Number(form.planDays),
        maxUses: Number(form.maxUses),
        ...(form.expiresAt ? { expiresAt: new Date(form.expiresAt).toISOString() } : {}),
        ...(form.code.trim() ? { code: form.code.trim().toUpperCase() } : {}),
      };
      const { data } = await createPremiumInvite(payload);
      setInvites((items) => [data.invite, ...items]);
      setForm({ planDays: 30, maxUses: 1, expiresAt: '', code: '' });
      toast.success('Invite code created.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not create an invite code.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Invite code copied.');
    } catch {
      toast.error('Could not copy the invite code.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invite code? This cannot be undone.')) return;
    try {
      await deletePremiumInvite(id);
      setInvites((items) => items.filter((item) => item._id !== id));
      toast.success('Invite code deleted.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not delete the invite code.');
    }
  };

  return (
    <LayoutShell>
      <div className='space-y-6'>
        <Header />

        <section className='rounded-3xl border border-slate-200/80 bg-white/85 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/75'>
          <div className='flex items-center gap-3'>
            <span className='flex h-11 w-11 items-center justify-center rounded-3xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200'><KeyRound className='h-5 w-5' /></span>
            <div>
              <h1 className='text-xl font-bold text-slate-900 dark:text-white'>Create Premium invite</h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>Generate controlled codes that grant premium task and file limits.</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className='mt-6 grid gap-4 sm:grid-cols-2'>
            <label className='block text-sm font-medium text-slate-700 dark:text-slate-200'>
              Custom code (optional)
              <input
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                placeholder='Auto-generated'
                maxLength={40}
                className='mt-2 h-11 w-full rounded-3xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
              />
            </label>
            <label className='block text-sm font-medium text-slate-700 dark:text-slate-200'>
              Duration (days)
              <input
                type='number'
                min='1'
                max='3650'
                required
                value={form.planDays}
                onChange={(event) => setForm({ ...form, planDays: event.target.value })}
                className='mt-2 h-11 w-full rounded-3xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
              />
            </label>
            <label className='block text-sm font-medium text-slate-700 dark:text-slate-200'>
              Maximum uses
              <input
                type='number'
                min='1'
                max='100000'
                required
                value={form.maxUses}
                onChange={(event) => setForm({ ...form, maxUses: event.target.value })}
                className='mt-2 h-11 w-full rounded-3xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
              />
            </label>
            <label className='block text-sm font-medium text-slate-700 dark:text-slate-200'>
              Expires at (optional)
              <input
                type='datetime-local'
                value={form.expiresAt}
                onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
                className='mt-2 h-11 w-full rounded-3xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
              />
            </label>
            <button
              type='submit'
              disabled={creating}
              className='inline-flex h-11 items-center justify-center gap-2 self-end rounded-3xl bg-violet-600 px-5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-500 disabled:opacity-60 sm:col-span-2'
            >
              {creating ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Plus className='h-4 w-4' />}
              {creating ? 'Creating...' : 'Create invite code'}
            </button>
          </form>
        </section>

        <section className='rounded-3xl border border-slate-200/80 bg-white/85 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/75'>
          <h2 className='text-lg font-semibold text-slate-900 dark:text-white'>Recent invite codes</h2>
          {loading ? (
            <div className='mt-4 flex items-center gap-2 text-sm text-slate-500'><LoaderCircle className='h-4 w-4 animate-spin' /> Loading...</div>
          ) : invites.length === 0 ? (
            <p className='mt-4 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300'>No invite codes created yet.</p>
          ) : (
            <div className='mt-4 space-y-3'>
              {invites.map((invite) => (
                <article key={invite._id} className='flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='min-w-0'>
                    <p className='font-mono text-sm font-bold tracking-wider text-slate-900 dark:text-white'>{invite.code}</p>
                    <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>
                      {invite.usedCount}/{invite.maxUses} used · {invite.planDays} days · expires {formatDate(invite.expiresAt)} · {invite.isActive ? 'active' : 'inactive'}
                    </p>
                  </div>
                  <div className='flex shrink-0 gap-2'>
                    <button
                      type='button'
                      onClick={() => void handleCopy(invite.code)}
                      className='inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                    >
                      <Copy className='h-3.5 w-3.5' /> {t.copy || 'Copy'}
                    </button>
                    <button
                      type='button'
                      onClick={() => void handleDelete(invite._id)}
                      className='inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-200'
                    >
                      <Trash2 className='h-3.5 w-3.5' /> Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <Footer />
      </div>
    </LayoutShell>
  );
};

export default InviteCreatePage;
