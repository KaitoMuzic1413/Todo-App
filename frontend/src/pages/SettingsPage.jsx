import { useState } from 'react';
import { Settings2, UserRound, Palette, Check, Globe, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { LayoutShell } from '@/components/LayoutShell';
import Header from '@/components/Header';
import { updateUserProfile } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { useUserPreferences } from '@/hooks/useUserPreferences';

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('todo-user') || 'null');
  } catch {
    return null;
  }
};

const SettingsPage = () => {
  const { t, language, setLanguage } = useLanguage();
  const currentUser = getStoredUser();
  const [savedName, setSavedName] = useState(() => currentUser?.name || '');
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { preferences, hasLoadedPreferences, savePreferences } = useUserPreferences(currentUser?._id);
  const selectedAccent = hasLoadedPreferences ? preferences.accent : (localStorage.getItem('todo-accent') || 'violet');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error(t.nameRequired);
      return;
    }

    try {
      setIsSaving(true);
      const response = await updateUserProfile(trimmedName);
      const updatedUser = { ...getStoredUser(), ...response.data.user };
      localStorage.setItem('todo-user', JSON.stringify(updatedUser));
      setSavedName(updatedUser.name);
      setName('');
      window.dispatchEvent(new Event('todo-auth-changed'));
      toast.success(t.nameUpdated);
    } catch (error) {
      toast.error(error.response?.data?.message || t.nameUpdateFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const selectAccent = async (accent) => {
    if (!hasLoadedPreferences) localStorage.setItem('todo-accent', accent);
    document.documentElement.dataset.accent = accent;
    try {
      await savePreferences({ accent });
    } catch {
      toast.error(t.preferencesSaveError);
    }
  };

  const selectTheme = async (theme) => {
    localStorage.setItem('todo-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      await savePreferences({ theme });
    } catch {
      toast.error(t.preferencesSaveError);
    }
  };

  const selectLanguage = async (nextLanguage) => {
    setLanguage(nextLanguage);
    try {
      await savePreferences({ language: nextLanguage });
    } catch {
      setLanguage(preferences.language);
      toast.error(t.preferencesSaveError);
    }
  };

  return (
    <LayoutShell>
      <div className='space-y-6'>
        <Header />
        <div className='flex items-center gap-3'>
          <span className='flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 shadow-sm dark:bg-violet-500/15 dark:text-violet-200'>
            <Settings2 className='h-5 w-5' />
          </span>
          <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>{t.settings}</h1>
        </div>

        <div className='grid gap-5 lg:grid-cols-2'>
          <section className='rounded-[28px] border border-slate-200/80 bg-white/85 p-6 shadow-[0_16px_44px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/75'>
            <div className='flex items-center gap-3'>
              <span className='flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'><UserRound className='h-5 w-5' /></span>
              <h2 className='text-lg font-semibold text-slate-900 dark:text-white'>{t.profile}</h2>
            </div>
            <form onSubmit={handleSubmit} className='mt-6'>
              <label className='block text-sm font-medium text-slate-700 dark:text-slate-200' htmlFor='display-name'>{t.displayName}</label>
              <div className='mt-2 flex flex-col gap-3 sm:flex-row'>
                <input
                  id='display-name'
                  type='text'
                  required
                  maxLength={80}
                  value={name}
                  placeholder={savedName || t.displayName}
                  onChange={(event) => setName(event.target.value)}
                  className='h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-700 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900/40'
                />
                <button
                  type='submit'
                  disabled={isSaving || !name.trim()}
                  className={`group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-2xl px-6 text-sm font-semibold text-white transition-all duration-300 ${
                    isSaving || !name.trim()
                      ? 'cursor-not-allowed bg-violet-500/40 opacity-50 dark:bg-violet-600/30'
                      : 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-accent active:scale-95 hover:-translate-y-0.5 hover:from-violet-500 hover:to-indigo-500 hover:shadow-accent-strong'
                  }`}
                >
                  {isSaving ? t.saving : t.save}
                </button>
              </div>
            </form>
          </section>

          <section className='rounded-[28px] border border-slate-200/80 bg-white/85 p-6 shadow-[0_16px_44px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/75'>
            <div className='flex items-center gap-3'>
              <span className='flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'><Palette className='h-5 w-5' /></span>
              <h2 className='text-lg font-semibold text-slate-900 dark:text-white'>{t.accentColor}</h2>
            </div>
            <div className='mt-6 grid grid-cols-2 gap-3'>
              {[
                { key: 'violet', color: '#8b5cf6' },
                { key: 'rose', color: '#f43f5e' },
                { key: 'emerald', color: '#10b981' },
                { key: 'amber', color: '#f59e0b' },
              ].map(({ key, color }) => (
                <button
                  key={key}
                  type='button'
                  aria-label={`${t.accentColor}: ${t[key] || key}`}
                  aria-pressed={selectedAccent === key}
                  onClick={() => void selectAccent(key)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm font-medium transition-colors ${selectedAccent === key ? 'border-violet-400 bg-violet-50 text-slate-900 dark:border-violet-500 dark:bg-violet-500/10 dark:text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:border-slate-600'}`}
                >
                  <span className='h-7 w-7 rounded-full shadow-inner' style={{ backgroundColor: color }} />
                  <span className='flex-1'>{t[key] || key}</span>
                  {selectedAccent === key ? <Check className='h-4 w-4 text-violet-600 dark:text-violet-300' /> : null}
                </button>
              ))}
            </div>
          </section>

          <section className='rounded-[28px] border border-slate-200/80 bg-white/85 p-6 shadow-[0_16px_44px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/75'>
            <div className='flex items-center gap-3'>
              <span className='flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'><Globe className='h-5 w-5' /></span>
              <h2 className='text-lg font-semibold text-slate-900 dark:text-white'>{t.theme} & {t.language}</h2>
            </div>
            <div className='mt-6 space-y-5'>
              <div>
                <p className='mb-2 text-sm font-medium text-slate-700 dark:text-slate-200'>{t.theme}</p>
                <div className='grid grid-cols-2 gap-2'>
                  {[
                    { key: 'light', label: t.lightMode, Icon: Sun },
                    { key: 'dark', label: t.darkMode, Icon: Moon },
                  ].map(({ key, label, Icon }) => (
                    <button key={key} type='button' aria-pressed={preferences.theme === key} onClick={() => void selectTheme(key)} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${preferences.theme === key ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-500/10 dark:text-violet-200' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:border-slate-600'}`}>
                      <Icon className='h-4 w-4' />{label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className='mb-2 text-sm font-medium text-slate-700 dark:text-slate-200'>{t.language}</p>
                <div className='grid grid-cols-2 gap-2'>
                  {[
                    { key: 'en', label: t.english },
                    { key: 'vi', label: t.vietnamese },
                  ].map(({ key, label }) => (
                    <button key={key} type='button' aria-pressed={language === key} onClick={() => void selectLanguage(key)} className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${language === key ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-500/10 dark:text-violet-200' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:border-slate-600'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </LayoutShell>
  );
};

export default SettingsPage;
