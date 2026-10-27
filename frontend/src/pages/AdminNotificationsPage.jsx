import { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, LoaderCircle, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { LayoutShell } from '@/components/LayoutShell';
import { deleteAdminNotification, fetchAdminNotifications, sendAdminNotification } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { sanitizeNotificationHtml } from '@/lib/notificationHtml';

const createRequestId = () => (globalThis.crypto?.randomUUID?.()
  || `notification-${Date.now()}-${Math.random().toString(36).slice(2)}`);

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const AdminNotificationsPage = () => {
  const { t } = useLanguage();
  const requestId = useRef(createRequestId());
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('system');
  const [audienceType, setAudienceType] = useState('all');
  const [email, setEmail] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState(null);
  const [deletingNotificationId, setDeletingNotificationId] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const response = await fetchAdminNotifications();
      setHistory(response.data.notifications || []);
    } catch (error) {
      setHistoryError(error.response?.data?.message || t.notificationSendError);
    } finally {
      setHistoryLoading(false);
    }
  }, [t.notificationSendError]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadHistory(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadHistory]);

  useEffect(() => {
    if (!isPreviewOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsPreviewOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSending(true);
    try {
      await sendAdminNotification({
        title,
        content,
        type,
        audience: type === 'welcome'
          ? { type: 'new-users' }
          : (audienceType === 'all' ? { type: 'all' } : { type: 'user', email }),
      }, requestId.current);
      toast.success(type === 'welcome' ? t.welcomeQueued : t.notificationSent);
      setTitle('');
      setContent('');
      requestId.current = createRequestId();
      setIsPreviewOpen(false);
      await loadHistory();
    } catch (error) {
      toast.error(error.response?.data?.message || (error.request ? t.notificationConnectionError : t.notificationSendError));
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteNotification = async () => {
    if (!notificationToDelete || deletingNotificationId) return;

    const notificationId = notificationToDelete.id;
    setDeletingNotificationId(notificationId);
    try {
      await deleteAdminNotification(notificationId);
      setHistory((currentHistory) => currentHistory.filter(({ id }) => id !== notificationId));
      setNotificationToDelete(null);
      toast.success(t.notificationDeleted);
    } catch (error) {
      toast.error(error.response?.data?.message || t.notificationDeleteError);
    } finally {
      setDeletingNotificationId('');
    }
  };

  const typeLabels = {
    system: t.systemType,
    welcome: t.welcomeType,
    update: t.updateType,
    task: t.taskType,
  };

  return (
    <LayoutShell>
      <div className='space-y-6'>
        <header className='rounded-3xl bg-gradient-to-br from-[#0e1939] via-[#172550] to-[#273d78] p-5 text-white shadow-[0_22px_55px_rgba(15,23,42,0.25)] sm:p-7'>
          <div className='flex items-center gap-4'>
            <span className='flex h-12 w-12 items-center justify-center rounded-3xl bg-white/10 text-violet-200'><BellRing className='h-5 w-5' /></span>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.17em] text-blue-200'>Todo App</p>
              <h1 className='mt-1 text-2xl font-bold sm:text-3xl'>{t.adminNotifications}</h1>
            </div>
          </div>
        </header>

        <section className='rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm sm:rounded-3xl sm:p-7 dark:border-slate-800 dark:bg-slate-900/80'>
          <h2 className='text-lg font-bold text-slate-900 dark:text-white'>{t.sendNotifications}</h2>
          <form onSubmit={(event) => void handleSubmit(event)} className='mt-5 space-y-5'>
            <div>
              <label htmlFor='notification-title' className='mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200'>{t.notificationTitle}</label>
              <input id='notification-title' required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className='min-h-12 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-violet-900/30' />
            </div>
            <div>
              <div className='mb-2 flex items-center justify-between gap-3'>
                <label htmlFor='notification-content' className='text-sm font-semibold text-slate-700 dark:text-slate-200'>{t.notificationContent}</label>
                <span className='text-xs text-slate-400'>{content.length}/5000</span>
              </div>
              <textarea id='notification-content' required maxLength={5000} rows={6} value={content} onChange={(event) => setContent(event.target.value)} placeholder={'Liên hệ tôi <a href="https://example.com/contact">click vào</a> để được hỗ trợ.'} className='min-h-36 w-full resize-y rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-violet-900/30' />
            </div>
            <div className='grid gap-5 sm:grid-cols-2'>
              <div>
                <label htmlFor='notification-type' className='mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200'>{t.notificationType}</label>
                <select id='notification-type' value={type} onChange={(event) => setType(event.target.value)} className='min-h-12 w-full rounded-3xl border border-slate-200 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-violet-900/30'>
                  {Object.entries(typeLabels).filter(([key]) => key !== 'task').map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              {type === 'welcome' ? (
                <p className='self-end rounded-3xl border border-violet-100 bg-violet-50 p-4 text-sm leading-6 text-violet-800 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200'>
                  {t.welcomeTypeDescription}
                </p>
              ) : (
                <fieldset>
                  <legend className='mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200'>{t.recipientAudience}</legend>
                  <div className='grid grid-cols-2 gap-2'>
                    {[
                      { value: 'all', label: t.allUsers },
                      { value: 'user', label: t.oneUser },
                    ].map(({ value, label }) => (
                      <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-3xl border px-3 text-sm font-medium transition ${audienceType === value ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-500/10 dark:text-violet-200' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'}`}>
                        <input type='radio' name='audience' value={value} checked={audienceType === value} onChange={() => setAudienceType(value)} className='accent-violet-600' />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
            {type !== 'welcome' && audienceType === 'user' ? (
              <div>
                <label htmlFor='recipient-email' className='mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200'>{t.recipientEmail}</label>
                <input id='recipient-email' type='email' required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className='min-h-12 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-violet-900/30' />
              </div>
            ) : null}
            <div className='flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-slate-800'>
              <button type='button' disabled={!title.trim() || !content.trim()} onClick={() => setIsPreviewOpen(true)} className='min-h-12 rounded-3xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'>{t.preview}</button>
              <button type='submit' disabled={isSending || !title.trim() || !content.trim() || (type !== 'welcome' && audienceType === 'user' && !email.trim())} className='inline-flex min-h-12 items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-45'>
                {isSending ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
                {isSending ? t.sending : t.send}
              </button>
            </div>
          </form>
        </section>

        <section className='rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm sm:p-7 dark:border-slate-800 dark:bg-slate-900/80'>
          <div className='flex items-center justify-between gap-3'>
            <h2 className='text-lg font-bold text-slate-900 dark:text-white'>{t.sentNotifications}</h2>
            <button type='button' onClick={() => void loadHistory()} className='min-h-10 rounded-3xl px-3 text-sm font-semibold text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-500/10'>{t.retry}</button>
          </div>
          {historyLoading ? (
            <div className='flex min-h-28 items-center justify-center text-violet-600 dark:text-violet-300'><LoaderCircle className='h-6 w-6 animate-spin' /><span className='sr-only'>{t.loading}</span></div>
          ) : historyError ? (
            <p role='alert' className='mt-5 rounded-3xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'>{historyError}</p>
          ) : history.length === 0 ? (
            <p className='mt-5 rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400'>{t.notificationHistoryEmpty}</p>
          ) : (
            <ul className='mt-4 divide-y divide-slate-100 dark:divide-slate-800'>
              {history.map((notification) => (
                <li key={notification.id} className='flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <h3 className='max-w-full break-words text-sm font-semibold text-slate-900 dark:text-white'>{notification.title}</h3>
                      <span className='rounded-3xl bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-200'>{typeLabels[notification.type] || notification.type}</span>
                    </div>
                    <p className='mt-1 line-clamp-2 break-words text-xs leading-5 text-slate-500 dark:text-slate-400' dangerouslySetInnerHTML={{ __html: sanitizeNotificationHtml(notification.content) }} />
                    <p className='mt-2 text-[11px] text-slate-400 dark:text-slate-500'>{formatDate(notification.createdAt)} · {notification.targetType === 'all' ? t.allUsers : (notification.targetType === 'new-users' ? t.newAccounts : t.oneUser)}</p>
                  </div>
                  <div className='flex shrink-0 items-center gap-3 text-xs text-slate-500 dark:text-slate-400'>
                    <span>{notification.recipients} {t.recipients.toLowerCase()}</span>
                    <span className='rounded-3xl bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'>{notification.read}/{notification.recipients} {t.readCount.toLowerCase()}</span>
                    <button type='button' aria-label={t.deleteNotification} title={t.deleteNotification} disabled={Boolean(deletingNotificationId)} onClick={() => setNotificationToDelete(notification)} className='flex h-10 w-10 items-center justify-center rounded-3xl text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300'>
                      <Trash2 className='h-4 w-4' />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {isPreviewOpen ? (
        <div className='fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 px-4 py-5 backdrop-blur-sm' onMouseDown={(event) => { if (event.target === event.currentTarget) setIsPreviewOpen(false); }}>
          <section role='dialog' aria-modal='true' aria-labelledby='notification-preview-title' className='flex w-[90vw] max-w-[600px] max-h-[78dvh] min-h-[50dvh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900'>
            <header className='flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800'>
              <div className='min-w-0'><p className='text-xs font-semibold uppercase tracking-[0.15em] text-violet-600 dark:text-violet-300'>{t.preview}</p><h2 id='notification-preview-title' className='mt-1 break-words text-lg font-bold text-slate-900 dark:text-white'>{title || t.notificationTitle}</h2></div>
              <button type='button' autoFocus onClick={() => setIsPreviewOpen(false)} aria-label={t.close} className='flex h-10 w-10 shrink-0 items-center justify-center rounded-3xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'><X className='h-5 w-5' /></button>
            </header>
            <div className='min-h-0 flex-1 overflow-y-auto px-5 py-5 [overscroll-behavior:contain]'>
              <p className='text-xs text-slate-500 dark:text-slate-400'>{typeLabels[type]} · {type === 'welcome' ? t.newAccounts : (audienceType === 'all' ? t.allUsers : email)}</p>
              <div className='notification-rich-content mt-4 break-words text-sm leading-7 text-slate-700 dark:text-slate-200' dangerouslySetInnerHTML={{ __html: sanitizeNotificationHtml(content || t.notificationContent) }} />
            </div>
          </section>
        </div>
      ) : null}

      {notificationToDelete ? (
        <div className='fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 px-4 py-5 backdrop-blur-sm' onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingNotificationId) setNotificationToDelete(null); }}>
          <section role='dialog' aria-modal='true' aria-labelledby='delete-notification-title' className='w-[90vw] max-w-[440px] rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-6'>
            <h2 id='delete-notification-title' className='text-lg font-bold text-slate-900 dark:text-white'>{t.deleteNotification}</h2>
            <p className='mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300'>{t.deleteNotificationConfirm}</p>
            <p className='mt-3 break-words text-sm font-semibold text-slate-800 dark:text-slate-100'>{notificationToDelete.title}</p>
            <div className='mt-6 flex justify-end gap-3'>
              <button type='button' disabled={Boolean(deletingNotificationId)} onClick={() => setNotificationToDelete(null)} className='min-h-11 rounded-3xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'>{t.cancel}</button>
              <button type='button' disabled={Boolean(deletingNotificationId)} onClick={() => void handleDeleteNotification()} className='inline-flex min-h-11 items-center gap-2 rounded-3xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60'>
                {deletingNotificationId === notificationToDelete.id ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Trash2 className='h-4 w-4' />}
                {t.deleteNotification}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </LayoutShell>
  );
};

export default AdminNotificationsPage;
