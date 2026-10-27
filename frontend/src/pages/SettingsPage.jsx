import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings2, Palette, Check, Globe, Moon, Sun, ShieldCheck, Pencil, X, Camera, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { LayoutShell } from '@/components/LayoutShell';
import { Link } from 'react-router-dom';
import { fetchCurrentUser, updateUserAvatar, updateUserProfile } from '@/lib/api';
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
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [savedName, setSavedName] = useState(() => currentUser?.name || '');
  const [name, setName] = useState(() => currentUser?.name || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);
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
      setName(updatedUser.name || '');
      window.dispatchEvent(new Event('todo-auth-changed'));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('todo-user');
    localStorage.removeItem('todo-user-email');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('todo-legal-accepted-version');
    sessionStorage.clear();
    window.dispatchEvent(new Event('todo-auth-changed'));
    navigate('/signin', { replace: true });
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(language === 'vi' ? 'Chỉ hỗ trợ ảnh JPG, PNG, WebP hoặc GIF.' : 'Only JPG, PNG, WebP, or GIF images are supported.');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error(language === 'vi' ? 'Ảnh đại diện phải nhỏ hơn 1 MB.' : 'Profile pictures must be smaller than 1 MB.');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const avatarUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read image'));
        reader.readAsDataURL(file);
      });
      const response = await updateUserAvatar(avatarUrl);
      const updatedUser = { ...getStoredUser(), ...response.data.user };
      localStorage.setItem('todo-user', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      window.dispatchEvent(new Event('todo-auth-changed'));
      toast.success(language === 'vi' ? 'Đã cập nhật ảnh đại diện.' : 'Profile picture updated.');
    } catch (error) {
      toast.error(error.response?.data?.message || (language === 'vi' ? 'Không thể cập nhật ảnh đại diện.' : 'Could not update profile picture.'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

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
      setSavedName(updatedUser.name || trimmedName);
      setName(updatedUser.name || trimmedName);
      setIsEditingName(false);
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
    <LayoutShell>
      <div className='space-y-6'>
        <header className='profile-theme-gradient overflow-hidden rounded-3xl p-5 text-white shadow-[0_24px_56px_rgba(15,23,42,0.24)] sm:rounded-3xl sm:p-7'>
          <div className='flex items-start gap-3 sm:gap-4'>
            <div className='flex min-w-0 flex-1 items-center gap-3 sm:gap-4'>
              <div className='group relative h-14 w-14 shrink-0 sm:h-16 sm:w-16'>
                <input
                  ref={avatarInputRef}
                  type='file'
                  accept='image/jpeg,image/png,image/webp,image/gif'
                  className='sr-only'
                  onChange={handleAvatarChange}
                  aria-label={language === 'vi' ? 'Thay đổi ảnh đại diện' : 'Change profile picture'}
                />
                <button
                  type='button'
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  title={language === 'vi' ? 'Thay đổi ảnh đại diện' : 'Change profile picture'}
                  aria-label={language === 'vi' ? 'Thay đổi ảnh đại diện' : 'Change profile picture'}
                  className='relative h-full w-full cursor-pointer overflow-hidden rounded-3xl bg-gradient-to-br from-violet-200 to-violet-500 text-base font-bold text-white ring-4 ring-white/20 transition disabled:cursor-wait sm:text-lg'
                >
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt='' className='h-full w-full object-cover' />
                  ) : (
                    <span>{(savedName || currentUser?.name || currentUser?.email || '?').trim().slice(0, 2).toUpperCase()}</span>
                  )}
                  <span className='absolute inset-0 flex items-center justify-center bg-slate-950/0 text-white opacity-0 transition group-hover:bg-slate-950/45 group-hover:opacity-100 group-focus-within:opacity-100'>
                    <Camera className='h-5 w-5' />
                  </span>
                  {isUploadingAvatar ? <span className='absolute inset-0 flex items-center justify-center bg-slate-950/55 text-xs text-white'>...</span> : null}
                </button>
              </div>
              <div className='min-w-0'>
                <p className='text-xs font-semibold uppercase tracking-[0.16em] text-white/75'>{t.profile}</p>
                {isEditingName ? (
                  <form onSubmit={handleSubmit} className='mt-1 flex min-w-0 items-center gap-2'>
                    <label className='sr-only' htmlFor='display-name'>{t.displayName}</label>
                    <input
                      id='display-name'
                      type='text'
                      required
                      autoFocus
                      maxLength={80}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className='h-10 min-w-0 flex-1 rounded-3xl border border-white/20 bg-white px-3 text-base font-semibold text-slate-900 outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-300/20 sm:text-lg'
                    />
                    <button
                      type='submit'
                      disabled={isSaving || !name.trim() || name.trim() === savedName.trim()}
                      aria-label={t.confirm}
                      title={t.confirm}
                      className='flex h-10 w-10 shrink-0 items-center justify-center rounded-3xl bg-emerald-400 text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50'
                    >
                      <Check className='h-5 w-5' />
                    </button>
                    <button
                      type='button'
                      onClick={() => { setName(savedName); setIsEditingName(false); }}
                      disabled={isSaving}
                      aria-label={t.cancel}
                      title={t.cancel}
                      className='flex h-10 w-10 shrink-0 items-center justify-center rounded-3xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-50'
                    >
                      <X className='h-5 w-5' />
                    </button>
                  </form>
                ) : (
                  <div className='mt-1 flex min-w-0 items-center gap-2'>
                    <h1 className='truncate text-lg font-bold sm:text-2xl'>{savedName || currentUser?.name || currentUser?.email?.split('@')[0] || t.appName}</h1>
                    <button
                      type='button'
                      onClick={() => { setName(savedName || currentUser?.name || ''); setIsEditingName(true); }}
                      aria-label={t.displayName}
                      title={t.displayName}
                      className='flex h-8 w-8 shrink-0 items-center justify-center rounded-3xl border border-white/15 bg-white/10 text-white/85 transition hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/25'
                    >
                      <Pencil className='h-4 w-4' />
                    </button>
                  </div>
                )}
                <p className='mt-1 truncate text-xs text-slate-300 sm:text-sm'>{currentUser?.email || ''}</p>
                <span className='mt-2 inline-flex items-center gap-1.5 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200'>
                  <span className='h-1.5 w-1.5 rounded-3xl bg-emerald-300' />{t.accountStatus}
                </span>
              </div>
            </div>
            <div className='flex shrink-0 items-center gap-2'>
              {currentUser?.isAdmin ? (
                <Link to='/admin/notifications' aria-label={t.adminNotifications} title={t.adminNotifications} className='flex h-12 w-12 items-center justify-center rounded-3xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30'>
                  <ShieldCheck className='h-5 w-5' />
                </Link>
              ) : null}
              <button
                type='button'
                onClick={handleLogout}
                aria-label={t.signOut}
                title={t.signOut}
                className='flex h-12 w-12 items-center justify-center rounded-3xl border border-white/20 bg-white/10 text-white transition hover:bg-rose-500/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30'
              >
                <LogOut className='h-5 w-5' />
              </button>
            </div>
          </div>
        </header>

        <div className='flex items-center gap-3'>
          <span className='flex h-12 w-12 items-center justify-center rounded-3xl bg-violet-100 text-violet-600 shadow-sm dark:bg-violet-500/15 dark:text-violet-200'>
            <Settings2 className='h-5 w-5' />
          </span>
          <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>{t.settings}</h1>
        </div>

        <div className='grid gap-5 lg:grid-cols-2'>
          <section className='rounded-3xl border border-slate-200/80 bg-white/85 p-6 shadow-[0_16px_44px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/75'>
            <div className='flex items-center gap-3'>
              <span className='flex h-10 w-10 items-center justify-center rounded-3xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'><Palette className='h-5 w-5' /></span>
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
                  className={`flex items-center gap-3 rounded-3xl border p-3 text-left text-sm font-medium transition-colors ${selectedAccent === key ? 'border-violet-400 bg-violet-50 text-slate-900 dark:border-violet-500 dark:bg-violet-500/10 dark:text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:border-slate-600'}`}
                >
                  <span className='h-7 w-7 rounded-3xl shadow-inner' style={{ backgroundColor: color }} />
                  <span className='flex-1'>{t[key] || key}</span>
                  {selectedAccent === key ? <Check className='h-4 w-4 text-violet-600 dark:text-violet-300' /> : null}
                </button>
              ))}
            </div>
          </section>

          <section className='rounded-3xl border border-slate-200/80 bg-white/85 p-6 shadow-[0_16px_44px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/75'>
            <div className='flex items-center gap-3'>
              <span className='flex h-10 w-10 items-center justify-center rounded-3xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'><Globe className='h-5 w-5' /></span>
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
                    <button key={key} type='button' aria-pressed={preferences.theme === key} onClick={() => void selectTheme(key)} className={`flex items-center justify-center gap-2 rounded-3xl border px-3 py-3 text-sm font-medium transition-colors ${preferences.theme === key ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-500/10 dark:text-violet-200' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:border-slate-600'}`}>
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
                    <button key={key} type='button' aria-pressed={language === key} onClick={() => void selectLanguage(key)} className={`rounded-3xl border px-3 py-3 text-sm font-medium transition-colors ${language === key ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-500/10 dark:text-violet-200' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:border-slate-600'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className='lg:col-span-2 rounded-3xl border border-slate-200/80 bg-white/85 p-6 shadow-[0_16px_44px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900/75'>
            <h2 className='text-lg font-semibold text-slate-900 dark:text-white'>Chính sách & điều khoản</h2>
            <p className='mt-2 text-sm text-slate-600 dark:text-slate-300'>Đọc các chính sách công khai của Kaito Todo.</p>
            <div className='mt-4 grid gap-3 sm:grid-cols-3'>
              <Link to='/policies/privacy' className='rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-violet-700 hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:text-violet-300 dark:hover:bg-violet-500/10'>Chính sách quyền riêng tư</Link>
              <Link to='/policies/terms' className='rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-violet-700 hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:text-violet-300 dark:hover:bg-violet-500/10'>Điều khoản sử dụng</Link>
              <Link to='/policies/cookies' className='rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-violet-700 hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:text-violet-300 dark:hover:bg-violet-500/10'>Cookie & lưu trữ thiết bị</Link>
            </div>
          </section>
        </div>
      </div>
    </LayoutShell>
  );
};

export default SettingsPage;
