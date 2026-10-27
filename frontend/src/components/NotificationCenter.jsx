import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion';
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
  <div className='flex shrink-0 items-center rounded-xl border border-slate-200 p-0.5 dark:border-slate-700' role='group' aria-label={label}>
    {['vi', 'en'].map((code) => (
      <button
        key={code}
        type='button'
        onClick={() => onChange(code)}
        aria-pressed={value === code}
        className={`rounded-lg px-2 py-1 text-[11px] font-semibold uppercase transition ${value === code ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
      >
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
  const [isDraggingDrawer, setIsDraggingDrawer] = useState(false);
  const drawerX = useMotionValue(typeof window === 'undefined' ? 320 : Math.min(320, window.innerWidth * 0.88));
  const getDrawerWidth = () => Math.min(320, window.innerWidth * 0.88);

  useEffect(() => { onDrawerOpenChange(drawerOpen); }, [drawerOpen, onDrawerOpenChange]);

  useEffect(() => {
    if (isDraggingDrawer) return undefined;
    const controls = animate(drawerX, drawerOpen ? 0 : getDrawerWidth(), {
      duration: 0.24,
      ease: [0.2, 0.8, 0.2, 1],
    });
    return () => controls.stop();
  }, [drawerOpen, isDraggingDrawer, drawerX]);

  useEffect(() => {
    const onTouchStart = (event) => {
      if (navigationOpen || drawerOpen || isDraggingDrawer || selectedId || !event.touches.length) {
        swipeStart.current = null;
        return;
      }
      const touch = event.touches[0];
      // Start anywhere in the app; a leftward horizontal drag pulls the drawer out.
      swipeStart.current = { x: touch.clientX, y: touch.clientY, horizontal: false };
    };
    const onTouchMove = (event) => {
      const start = swipeStart.current;
      if (!start || navigationOpen || drawerOpen || selectedId || !event.touches.length) return;
      const touch = event.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (!start.horizontal) {
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
          swipeStart.current = null;
          return;
        }
        if (dx > -8) return;
        start.horizontal = true;
        setIsDraggingDrawer(true);
        setFilter('all');
      }
      if (event.cancelable) event.preventDefault();
      drawerX.set(Math.max(0, Math.min(getDrawerWidth(), getDrawerWidth() + dx)));
    };
    const onTouchEnd = (event) => {
      const start = swipeStart.current;
      if (!start) return;
      swipeStart.current = null;
      if (!start.horizontal || !event.changedTouches.length) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const width = getDrawerWidth();
      const openedDistance = width - drawerX.get();
      const shouldOpen = Math.abs(dx) > Math.abs(dy) * 1.2 && openedDistance >= width * 0.35;
      setIsDraggingDrawer(false);
      setDrawerOpen(shouldOpen);
    };
    const onTouchCancel = () => {
      if (!swipeStart.current?.horizontal) {
        swipeStart.current = null;
        return;
      }
      swipeStart.current = null;
      setIsDraggingDrawer(false);
      setDrawerOpen(false);
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [navigationOpen, drawerOpen, isDraggingDrawer, selectedId, drawerX]);

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
        {(drawerOpen || isDraggingDrawer) ? (
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
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='fixed inset-y-0 right-0 z-[61] flex w-[min(320px,88vw)] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950'
              style={{ x: drawerX, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <header className='flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6'>
                <div className='min-w-0'>
                  <h2 id='notification-drawer-title' className='truncate text-lg font-bold text-slate-900 dark:text-white'>{t.notifications}</h2>
                  {unreadCount > 0 ? <p className='mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400'>{unreadCount} {t.unreadNotifications.toLowerCase()}</p> : null}
                </div>
                <div className='flex shrink-0 items-center gap-2'>
                  <NotificationLanguageToggle value={activeContentLanguage} onChange={setContentLanguage} label={t.notificationLanguage} />
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
                    {notifications.map((notification) => (
                      <li key={notification.id}>
                        <button
                          type='button'
                          onClick={() => void openNotification(notification.id)}
                          className={`w-full rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${notification.isRead ? 'border-slate-100 bg-white text-slate-600 hover:border-slate-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-slate-700' : 'border-violet-100 bg-violet-50/80 text-slate-900 hover:border-violet-200 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-slate-100 dark:hover:border-violet-500/40'}`}
                        >
                          <span className='flex items-start gap-3'>
                            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-3xl ${notification.isRead ? 'bg-slate-300 dark:bg-slate-700' : 'bg-violet-600 dark:bg-violet-300'}`} aria-hidden='true' />
                            <span className='min-w-0 flex-1'>
                              <span className={`block truncate text-sm ${notification.isRead ? 'font-medium' : 'font-bold'}`}>{translatedNotifications[notification.id]?.title || notification.title}</span>
                              <span className='notification-rich-content mt-1 block overflow-hidden text-ellipsis text-xs leading-5 text-slate-500 dark:text-slate-400' style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: sanitizeNotificationHtml(translatedNotifications[notification.id]?.content || notification.content) }} />
                              <span className='mt-2 block text-[11px] text-slate-400 dark:text-slate-500'>{formatDate(notification.createdAt || notification.deliveredAt)}</span>
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
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
