import { useEffect, useState } from 'react';
import { Settings2, UserRound, Palette, Check, Globe, Moon, Sun, Download, Menu, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { LayoutShell } from '@/components/LayoutShell';
import { Link } from 'react-router-dom';
import NotificationCenter from '@/components/NotificationCenter';
import { fetchCurrentUser, updateUserProfile } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { getInstallPromptAvailable, promptInstall, subscribeToInstallState } from '@/lib/pwaInstall';
import { applyPwaUpdate, hasPwaUpdate, subscribeToPwaUpdate } from '@/lib/pwaUpdates';

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('todo-user') || 'null');
  } catch {
    return null;
  }
};

const SettingsPage = () => {
  const { t, language, setLanguage } = useLanguage();
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [savedName, setSavedName] = useState(() => currentUser?.name || '');
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [canInstall, setCanInstall] = useState(getInstallPromptAvailable);
  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
  const [hasUpdate, setHasUpdate] = useState(hasPwaUpdate);
  const { preferences, hasLoadedPreferences, savePreferences } = useUserPreferences(currentUser?._id);
  const selectedAccent = hasLoadedPreferences ? preferences.accent : (localStorage.getItem('todo-accent') || 'violet');

  useEffect(() => {
    document.documentElement.dataset.accent = selectedAccent;
  }, [selectedAccent]);

  useEffect(() => {
    let active = true;
    fetchCurrentUser().then(({ data }) => {
      if (!active) return;
      const updatedUser = { ...getStoredUser(), ...data.user };
      localStorage.setItem('todo-user', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      setSavedName(updatedUser.name || '');
      window.dispatchEvent(new Event('todo-auth-changed'));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToInstallState(() => setCanInstall(getInstallPromptAvailable()));
    const unsubscribeUpdate = subscribeToPwaUpdate(() => setHasUpdate(hasPwaUpdate()));
    const handleInstalled = () => setIsInstalled(true);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      unsubscribe();
      unsubscribeUpdate();
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

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
      setCurrentUser(updatedUser);
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
    <LayoutShell showShellMenuButton={false}>
      {({ openSidebar }) => (
      <div className='space-y-6'>
        <header className='overflow-hidden rounded-[30px] bg-gradient-to-br from-[#101a3a] via-[#172750] to-[#293c7b] p-5 text-white shadow-[0_24px_56px_rgba(15,23,42,0.24)] sm:rounded-[34px] sm:p-7'>
          <div className='flex items-start gap-3 sm:gap-4'>
            <button type='button' onClick={openSidebar} aria-label={t.openNavigation || 'Open navigation'} className='flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/25 sm:h-12 sm:w-12'>
              <Menu className='h-5 w-5' />
            </button>
            <div className='flex min-w-0 flex-1 items-center gap-3 sm:gap-4'>
              <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-violet-300 text-base font-bold text-[#111b3a] ring-4 ring-white/10 sm:h-14 sm:w-14 sm:text-lg' aria-hidden='true'>
                {(savedName || currentUser?.name || currentUser?.email || '?').trim().slice(0, 2).toUpperCase()}
              </div>
              <div className='min-w-0'>
                <p className='text-xs font-semibold uppercase tracking-[0.16em] text-blue-200'>{t.profile}</p>
                <h1 className='mt-1 truncate text-lg font-bold sm:text-2xl'>{savedName || currentUser?.name || currentUser?.email?.split('@')[0] || t.appName}</h1>
                <p className='mt-1 truncate text-xs text-slate-300 sm:text-sm'>{currentUser?.email || ''}</p>
                <span className='mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200'>
                  <span className='h-1.5 w-1.5 rounded-full bg-emerald-300' />{t.accountStatus}
                </span>
              </div>
            </div>
            <div className='flex shrink-0 items-center gap-2'>
              {currentUser?.isAdmin ? (
                <Link to='/admin/notifications' aria-label={t.adminNotifications} title={t.adminNotifications} className='flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30'>
                  <ShieldCheck className='h-5 w-5' />
                </Link>
              ) : null}
              <NotificationCenter userId={currentUser?._id} />
            </div>
          </div>
          <p className='ml-14 mt-4 max-w-2xl text-sm leading-6 text-blue-100/80 sm:ml-16'>{t.profileSettings}</p>
        </header>

        <div className='flex items-center gap-3'>
          <span className='flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 shadow-sm dark:bg-violet-500/15 dark:text-violet-200'>
            <Settings2 className='h-5 w-5' />
          </span>
          <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>{t.settings}</h1>
        </div>

        <div className='grid gap-5 lg:grid-cols-2'>
          <section className='rounded-3xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_16px_44px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:rounded-[28px] sm:p-6 dark:border-slate-800 dark:bg-slate-900/75'>
            <div className='flex items-center gap-3'>
              <span className='flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'><UserRound className='h-5 w-5' /></span>
              <h2 className='text-lg font-semibold text-slate-900 dark:text-white'>{t.profile}</h2>
            </div>
            <form onSubmit={handleSubmit} className='mt-5 sm:mt-6'>
              <label className='block text-sm font-medium text-slate-700 dark:text-slate-200' htmlFor='display-name'>{t.displayName}</label>
              <div className='mt-2.5 flex flex-col gap-2.5 sm:flex-row sm:gap-3'>
                <input
                  id='display-name'
                  type='text'
                  required
                  maxLength={80}
                  value={name}
                  placeholder={savedName || t.displayName}
                  onChange={(event) => setName(event.target.value)}
                  className='h-12 min-h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-violet-900/40 sm:rounded-2xl'
                />
                <button
                  type='submit'
                  disabled={isSaving || !name.trim()}
                  className={`group relative inline-flex h-12 min-h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 text-sm font-semibold text-white transition-all duration-300 sm:w-auto sm:min-w-28 sm:rounded-2xl sm:px-6 ${
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

          <section className='rounded-[28px] border border-slate-200/80 bg-white/85 p-6 shadow-[0_16px_44px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/75'>
            <div className='flex items-center gap-3'>
              <span className='flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200'><Download className='h-5 w-5' /></span>
              <h2 className='text-lg font-semibold text-slate-900 dark:text-white'>{t.installApp}</h2>
            </div>
            <p className='mt-5 text-sm text-slate-600 dark:text-slate-300'>
              {isInstalled ? (hasUpdate ? t.appUpdateAvailable : t.appInstalled) : canInstall ? t.installAppDescription : t.installAppInstructions}
            </p>
            {isInstalled && hasUpdate && (
              <button
                type='button'
                onClick={applyPwaUpdate}
                className='mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 active:scale-[.98]'
              >
                <Download className='h-4 w-4' />{t.updateApp}
              </button>
            )}
            {canInstall && !isInstalled && (
              <button
                type='button'
                onClick={() => void promptInstall().then(() => setCanInstall(false))}
                className='mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 active:scale-[.98]'
              >
                <Download className='h-4 w-4' />{t.install}
              </button>
            )}
          </section>
        </div>
      </div>
      )}
    </LayoutShell>
  );
};

export default SettingsPage;
