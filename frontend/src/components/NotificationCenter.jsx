import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Check, LoaderCircle, X } from 'lucide-react';
import {
  fetchNotification,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
  translateNotificationTexts,
} from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { hasNotificationHtml, sanitizeNotificationHtml } from '@/lib/notificationHtml';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const translationCache = new Map();
const MAX_CACHED_TRANSLATIONS = 1000;

const cacheKey = (language, text) => `${language}\u0000${text}`;

const rememberTranslation = (key, value) => {
  translationCache.set(key, value);
  if (translationCache.size > MAX_CACHED_TRANSLATIONS) {
    const oldestKey = translationCache.keys().next().value;
    if (oldestKey) translationCache.delete(oldestKey);
  }
};

const translateTextsInBatches = async (texts, language) => {
  const translations = new Array(texts.length);
  const pending = [];

  texts.forEach((text, index) => {
    const key = cacheKey(language, text);
    if (translationCache.has(key)) {
      translations[index] = translationCache.get(key);
    } else {
      pending.push({ text, index, key });
    }
  });

  for (let start = 0; start < pending.length; start += 40) {
    const batch = pending.slice(start, start + 40);
    const { data } = await translateNotificationTexts(batch.map(({ text }) => text), language);
    const values = Array.isArray(data.translations) ? data.translations : batch.map(({ text }) => text);
    const canCache = !data.fallback;
    batch.forEach((item, index) => {
      const value = values[index] || item.text;
      translations[item.index] = value;
      if (canCache) rememberTranslation(item.key, value);
    });
  }

  return translations;
};

const NotificationLanguageToggle = ({ value, onChange, label }) => (
  <div className='relative grid shrink-0 grid-cols-2 rounded-3xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-900' role='group' aria-label={label}>
    <motion.span aria-hidden='true' className='absolute bottom-0.5 top-0.5 w-[calc(50%-2px)] rounded-3xl bg-violet-100 shadow-sm dark:bg-violet-500/20' initial={false} animate={{ x: value === 'vi' ? 0 : '100%' }} transition={{ type: 'spring', stiffness: 420, damping: 32 }} />
    {['vi', 'en'].map((code) => (
      <button key={code} type='button' onClick={() => onChange(code)} aria-pressed={value === code} className={`relative z-10 min-w-8 rounded-3xl px-2.5 py-1 text-[11px] font-bold uppercase transition-colors ${value === code ? 'text-violet-700 dark:text-violet-100' : 'text-slate-500 hover:text-violet-700 dark:text-slate-300 dark:hover:text-violet-200'}`}>
        {code}
      </button>
    ))}
  </div>
);

const NotificationCenter = ({ userId, navigationOpen = false, onDrawerOpenChange = () => {} }) => {
  const { t, language } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [contentLanguage, setContentLanguage] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [translatedNotifications, setTranslatedNotifications] = useState({});
  const [translatedDetail, setTranslatedDetail] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const activeContentLanguage = contentLanguage || language;
  const notificationButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const detailRef = useRef(null);
  const swipeStart = useRef(null);
  const notificationSwipeStart = useRef(null);
  const suppressNotificationClick = useRef(false);

  useEffect(() => { onDrawerOpenChange(drawerOpen); }, [drawerOpen, onDrawerOpenChange]);

  useEffect(() => {
    const onTouchStart = (event) => {
      if (navigationOpen || drawerOpen || selectedId || !event.touches.length) {
        swipeStart.current = null;
        return;
      }
      const touch = event.touches[0];
      if (touch.clientX >= window.innerWidth - 32) {
        swipeStart.current = { x: touch.clientX, y: touch.clientY };
      } else {
        swipeStart.current = null;
      }
    };
    const onTouchEnd = (event) => {
      if (!swipeStart.current || !event.changedTouches.length) return;
      const start = swipeStart.current;
      swipeStart.current = null;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (!navigationOpen && !drawerOpen && !selectedId && dx < -55 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        setFilter('all');
        setDrawerOpen(true);
      }
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [navigationOpen, drawerOpen, selectedId]);

  const focusNotificationButton = useCallback(() => {
    window.setTimeout(() => notificationButtonRef.current?.focus(), 0);
  }, []);

  const refreshCount = useCallback(async () => {
    if (!userId) return;
    const response = await fetchUnreadNotificationCount();
    setUnreadCount(response.data.count);
  }, [userId]);

  const refreshList = useCallback(async (nextFilter = filter) => {
    setListLoading(true);
    setListError('');
    try {
      const response = await fetchNotifications(nextFilter);
      setNotifications(response.data.notifications || []);
    } catch {
      setListError(t.notificationsLoadError);
    } finally {
      setListLoading(false);
    }
  }, [filter, t.notificationsLoadError]);

  useEffect(() => {
    if (!userId) return undefined;
    const initialTimer = window.setTimeout(() => { void refreshCount().catch(() => {}); }, 0);
    const timer = window.setInterval(() => {
      void refreshCount().catch(() => {});
      if (drawerOpen) void refreshList(filter);
    }, 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [drawerOpen, filter, refreshCount, refreshList, userId]);

  useEffect(() => {
    let active = true;
    if (notifications.length === 0) {
      const resetTimer = window.setTimeout(() => {
        if (active) setTranslatedNotifications({});
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(resetTimer);
      };
    }
    const texts = notifications.flatMap((item) => [item.title || '', hasNotificationHtml(item.content) ? '' : (item.content || '')]);
    void translateTextsInBatches(texts, activeContentLanguage).then((translations) => {
      if (!active || !Array.isArray(translations)) return;
      const translated = {};
      notifications.forEach((item, index) => {
        translated[item.id] = {
          title: translations[index * 2] || item.title,
          content: hasNotificationHtml(item.content) ? item.content : (translations[index * 2 + 1] || item.content),
        };
      });
      setTranslatedNotifications(translated);
    }).catch(() => {
      if (active) setTranslatedNotifications({});
    });
    return () => { active = false; };
  }, [activeContentLanguage, notifications]);

  useEffect(() => {
    let active = true;
    if (!detail) {
      const resetTimer = window.setTimeout(() => {
        if (active) setTranslatedDetail(null);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(resetTimer);
      };
    }
    void translateTextsInBatches([detail.title || '', hasNotificationHtml(detail.content) ? '' : (detail.content || '')], activeContentLanguage)
      .then((translations) => {
        if (active && Array.isArray(translations)) {
          setTranslatedDetail({
            title: translations[0] || detail.title,
            content: hasNotificationHtml(detail.content) ? detail.content : (translations[1] || detail.content),
          });
        }
      })
      .catch(() => { if (active) setTranslatedDetail(null); });
    return () => { active = false; };
  }, [detail, activeContentLanguage]);

  useEffect(() => {
    if (!drawerOpen || !userId) return undefined;
    const timer = window.setTimeout(() => { void refreshList(filter); }, 0);
    return () => window.clearTimeout(timer);
  }, [drawerOpen, filter, refreshList, userId]);

  useEffect(() => {
    if (!drawerOpen && !selectedId) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [drawerOpen, selectedId]);

  useEffect(() => {
    if (!drawerOpen && !selectedId) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Tab') {
        const dialog = selectedId ? detailRef.current : drawerRef.current;
        const focusable = dialog?.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!focusable?.length) {
          event.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.key !== 'Escape') return;
      if (selectedId) {
        setSelectedId(null);
        setDetail(null);
        focusNotificationButton();
      } else {
        setDrawerOpen(false);
        focusNotificationButton();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen, focusNotificationButton, selectedId]);

  const handleNotificationTouchStart = (event, notification) => {
    if (filter !== 'unread' || notification.isRead || event.touches.length !== 1) {
      notificationSwipeStart.current = null;
      return;
    }
    const touch = event.touches[0];
    notificationSwipeStart.current = { id: notification.id, x: touch.clientX, y: touch.clientY };
  };

  const handleNotificationTouchEnd = async (event) => {
    const start = notificationSwipeStart.current;
    notificationSwipeStart.current = null;
    if (!start || !event.changedTouches.length || filter !== 'unread') return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dx > -60 || Math.abs(dx) < Math.abs(dy) * 1.25) return;

    suppressNotificationClick.current = true;
    window.setTimeout(() => { suppressNotificationClick.current = false; }, 350);
    const previous = notifications.find((item) => item.id === start.id);
    if (!previous || previous.isRead) return;
    setNotifications((items) => items.filter((item) => item.id !== start.id));
    setUnreadCount((count) => (typeof count === 'number' ? Math.max(0, count - 1) : count));
    try {
      await markNotificationRead(start.id);
      await refreshCount().catch(() => {});
    } catch {
      setNotifications((items) => items.some((item) => item.id === start.id) ? items : [previous, ...items]);
      await refreshCount().catch(() => {});
      setListError(t.notificationReadError);
    }
  };

  const handleNotificationClick = (notificationId) => {
    if (suppressNotificationClick.current) {
      suppressNotificationClick.current = false;
      return;
    }
    void openNotification(notificationId);
  };

  const openNotification = async (notificationId) => {
    setDrawerOpen(false);
    setSelectedId(notificationId);
    setDetail(null);
    setTranslatedDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const readResponse = await markNotificationRead(notificationId);
      setNotifications((items) => items.map((item) => item.id === notificationId
        ? { ...item, isRead: true, readAt: readResponse.data.readAt }
        : item));
      const response = await fetchNotification(notificationId);
      setDetail(response.data.notification);
      await refreshCount().catch(() => {});
    } catch (error) {
      setDetailError(error.response?.data?.message || t.notificationDetailsLoadError);
    } finally {
      setDetailLoading(false);
    }
  };

  const retryDetail = () => {
    if (selectedId) void openNotification(selectedId);
  };

  const openDrawer = () => {
    setFilter('all');
    setDrawerOpen(true);
  };

  return (
    <>
      <button
        ref={notificationButtonRef}
        type='button'
        onClick={() => { if (!navigationOpen) openDrawer(); }}
        disabled={navigationOpen}
        aria-disabled={navigationOpen}
        aria-label={`${t.notifications}${unreadCount > 0 ? `, ${unreadCount} ${t.unreadNotifications.toLowerCase()}` : ''}`}
        className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl border border-violet-300/70 bg-white/85 text-violet-700 shadow-md backdrop-blur-md transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/25 dark:border-violet-500/30 dark:bg-slate-900/85 dark:text-violet-200 ${navigationOpen ? 'cursor-not-allowed opacity-40' : 'hover:bg-violet-50 dark:hover:bg-violet-500/10'}`}
      >
        <Bell className='h-5 w-5' />
        {unreadCount > 0 ? (
          <span className='absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-3xl border-2 border-white bg-rose-500 px-1 text-[10px] font-bold leading-none text-white dark:border-slate-900' aria-hidden='true'>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {drawerOpen ? (
          <>
            <motion.button
              type='button'
              aria-label={t.close}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className='fixed inset-0 z-[60] cursor-default bg-slate-950/50 backdrop-blur-[2px]'
              onClick={() => { setDrawerOpen(false); focusNotificationButton(); }}
            />
            <motion.aside
              ref={drawerRef}
              role='dialog'
              aria-modal='true'
              aria-labelledby='notification-drawer-title'
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
              className='fixed inset-y-0 right-0 z-[61] flex w-[min(320px,88vw)] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950'
              style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <header className='flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6'>
                <div className='min-w-0'>
                  <h2 id='notification-drawer-title' className='truncate text-lg font-bold text-slate-900 dark:text-white'>{t.notifications}</h2>
                  {unreadCount > 0 ? <p className='mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400'>{unreadCount} {t.unreadNotifications.toLowerCase()}</p> : null}
                </div>
                <div className='flex shrink-0 items-center gap-2'>
                  <NotificationLanguageToggle value={activeContentLanguage} onChange={(code) => { setContentLanguage(code); setLanguage(code); }} label={t.notificationLanguage} />
                  <button type='button' autoFocus onClick={() => { setDrawerOpen(false); focusNotificationButton(); }} aria-label={t.close} className='flex h-10 w-10 items-center justify-center rounded-3xl border border-violet-200/70 text-violet-700 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-violet-500/20 dark:text-violet-200 dark:hover:bg-violet-500/10'>
                    <X className='h-5 w-5' />
                  </button>
                </div>
              </header>
              <div className='shrink-0 border-b border-slate-100 px-5 py-3 dark:border-slate-800 sm:px-6'>
                <div className='relative grid grid-cols-3 gap-1 rounded-3xl bg-slate-100 p-1 dark:bg-slate-900' role='tablist' aria-label={t.notifications}>
                  <motion.span aria-hidden='true' layoutId='notification-filter-indicator' className='absolute bottom-1 top-1 rounded-3xl bg-violet-100 shadow-sm dark:bg-violet-500/15' initial={false} animate={{ left: filter === 'all' ? '4px' : filter === 'unread' ? 'calc(33.333% + 1px)' : 'calc(66.666% - 2px)', width: 'calc(33.333% - 2px)' }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                  {[
                    { key: 'all', label: t.allNotifications },
                    { key: 'unread', label: t.unreadNotifications },
                    { key: 'task', label: t.taskNotifications },
                  ].map(({ key, label }) => (
                    <button key={key} type='button' role='tab' aria-selected={filter === key} onClick={() => setFilter(key)} className={`relative z-10 min-h-10 rounded-3xl px-1 text-xs font-semibold transition-colors sm:px-2 sm:text-sm ${filter === key ? 'text-violet-700 dark:text-violet-100' : 'text-slate-500 hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-200'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className='min-h-0 flex-1 overflow-y-auto px-4 py-3 [overscroll-behavior:contain] sm:px-5' style={{ touchAction: 'pan-y' }}>
                {listLoading ? (
                  <div className='flex min-h-48 items-center justify-center text-violet-600 dark:text-violet-300'><LoaderCircle className='h-6 w-6 animate-spin' /><span className='sr-only'>{t.loading}</span></div>
                ) : listError ? (
                  <div className='flex min-h-48 flex-col items-center justify-center gap-3 text-center'>
                    <p className='text-sm text-rose-600 dark:text-rose-300'>{listError}</p>
                    <button type='button' onClick={() => void refreshList(filter)} className='min-h-10 rounded-3xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900'>{t.retry}</button>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className='flex min-h-56 flex-col items-center justify-center px-6 text-center'>
                    <span className='mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300'><Check className='h-6 w-6' /></span>
                    <p className='text-sm font-medium text-slate-600 dark:text-slate-300'>{filter === 'task' ? t.noTaskNotifications : t.noNotifications}</p>
                  </div>
                ) : (
                  <ul className='space-y-2'>
                    <AnimatePresence initial={false}>
                      {notifications.map((notification) => (
                        <motion.li key={notification.id} layout initial={{ opacity: 0, x: 0 }} exit={{ opacity: 0, x: -36, height: 0, marginBottom: 0, transition: { duration: 0.22, ease: 'easeOut' } }} transition={{ layout: { duration: 0.22, ease: 'easeOut' } }} className='overflow-hidden'>
                          <button
                            type='button'
                            onTouchStart={(event) => handleNotificationTouchStart(event, notification)}
                            onTouchEnd={(event) => void handleNotificationTouchEnd(event)}
                            onClick={() => handleNotificationClick(notification.id)}
                            aria-label={filter === 'unread' && !notification.isRead ? `${translatedNotifications[notification.id]?.title || notification.title}. ${t.swipeToRead}` : (translatedNotifications[notification.id]?.title || notification.title)}
                            className={`w-full rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${notification.isRead ? 'border-slate-100 bg-white text-slate-600 hover:border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-slate-700' : 'border-violet-100 bg-violet-50/80 text-slate-900 hover:border-violet-200 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-slate-100 dark:hover:border-violet-500/40'}`}
                          >
                            <span className='flex items-start gap-3'>
                              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-3xl ${notification.isRead ? 'bg-slate-300 dark:bg-slate-700' : 'bg-violet-600 dark:bg-violet-300'}`} aria-hidden='true' />
                              <span className='min-w-0 flex-1'>
                                <span className={`block truncate text-sm ${notification.isRead ? 'font-medium' : 'font-bold'}`}>{translatedNotifications[notification.id]?.title || notification.title}</span>
                                <span className='notification-rich-content mt-1 block overflow-hidden text-ellipsis text-xs leading-5 text-slate-500 dark:text-slate-400' style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: sanitizeNotificationHtml(translatedNotifications[notification.id]?.content || notification.content) }} />
                                <span className='mt-2 block text-[11px] text-slate-400 dark:text-slate-500'>{formatDate(notification.createdAt || notification.deliveredAt)}</span>
                                {filter === 'unread' && !notification.isRead ? <span className='mt-1 block text-[10px] font-medium text-violet-600 dark:text-violet-300'>{t.swipeToRead}</span> : null}
                              </span>
                            </span>
                          </button>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {selectedId ? (
          <motion.div
            key='notification-detail-overlay'
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className='fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 px-4 py-4 backdrop-blur-sm sm:px-6'
            style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedId(null);
                setDetail(null);
                focusNotificationButton();
              }
            }}
          >
            <motion.section
              ref={detailRef}
              role='dialog'
              aria-modal='true'
              aria-labelledby='notification-detail-title'
              initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={{ duration: 0.2 }}
              className='flex w-[90vw] min-h-[50dvh] max-w-[600px] max-h-[78dvh] flex-col overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900'
            >
              <header className='flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5 dark:border-slate-800'>
                <div className='min-w-0'>
                  <p className='text-xs font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300'>{t.notifications}</p>
                  <h2 id='notification-detail-title' className='mt-1 break-words text-lg font-bold leading-7 text-slate-900 dark:text-white sm:text-xl'>
                    {translatedDetail?.title || detail?.title || t.notifications}
                  </h2>
                  {detail?.createdAt ? <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>{t.sentAt}: {formatDate(detail.createdAt)}</p> : null}
                </div>
                <div className='flex shrink-0 items-center gap-2'>
                  <NotificationLanguageToggle value={activeContentLanguage} onChange={setContentLanguage} label={t.notificationLanguage} />
                  <button type='button' autoFocus onClick={() => { setSelectedId(null); setDetail(null); focusNotificationButton(); }} aria-label={t.close} className='flex h-10 w-10 shrink-0 items-center justify-center rounded-3xl border border-violet-200/70 text-violet-700 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-violet-500/20 dark:text-violet-200 dark:hover:bg-violet-500/10'>
                    <X className='h-5 w-5' />
                  </button>
                </div>
              </header>
              <div className='min-h-0 flex-1 overflow-y-auto px-5 py-5 [overscroll-behavior:contain] sm:px-6 sm:py-6' style={{ touchAction: 'pan-y' }}>
                {detailLoading ? (
                  <div className='flex min-h-32 items-center justify-center text-violet-600 dark:text-violet-300'><LoaderCircle className='h-6 w-6 animate-spin' /><span className='sr-only'>{t.loading}</span></div>
                ) : detailError ? (
                  <div className='flex min-h-32 flex-col items-center justify-center gap-3 text-center'>
                    <p className='text-sm text-rose-600 dark:text-rose-300'>{detailError || t.notificationReadError}</p>
                    <button type='button' onClick={retryDetail} className='min-h-10 rounded-3xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'>{t.retry}</button>
                  </div>
                ) : (
                  <div className='notification-rich-content break-words text-sm leading-7 text-slate-700 dark:text-slate-200' dangerouslySetInnerHTML={{ __html: sanitizeNotificationHtml(translatedDetail?.content || detail?.content || '') }} />
                )}
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
};

export default NotificationCenter;
