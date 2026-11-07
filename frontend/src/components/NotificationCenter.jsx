import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue } from 'framer-motion';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  LoaderCircle,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import SwipeActionBackground from '@/components/SwipeActionBackground';
import {
  fetchNotification,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationState,
  translateNotificationTexts,
} from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { openNotificationEventStream } from '@/lib/notificationEvents';
import { sanitizeNotificationHtml } from '@/lib/notificationHtml';

const SWIPE_ACTION_WIDTH = 92;
const MAX_CACHED_TRANSLATIONS = 1000;
const translationCache = new Map();

const cacheKey = (lang, text) => `${lang}\u0000${text}`;

const rememberTranslation = (key, value) => {
  translationCache.set(key, value);
  if (translationCache.size > MAX_CACHED_TRANSLATIONS) {
    const oldestKey = translationCache.keys().next().value;
    if (oldestKey) translationCache.delete(oldestKey);
  }
};

const translateTextsInBatches = async (texts, targetLanguage) => {
  const translations = new Array(texts.length);
  const pending = [];

  texts.forEach((text, index) => {
    const key = cacheKey(targetLanguage, text);
    if (translationCache.has(key)) {
      translations[index] = translationCache.get(key);
    } else {
      pending.push({ text, index, key });
    }
  });

  for (let start = 0; start < pending.length; start += 40) {
    const batch = pending.slice(start, start + 40);
    const { data } = await translateNotificationTexts(
      batch.map(({ text }) => text),
      targetLanguage
    );
    const values = Array.isArray(data.translations)
      ? data.translations
      : batch.map(({ text }) => text);
    const canCache = !data.fallback;
    batch.forEach((item, index) => {
      const value = values[index] || item.text;
      translations[item.index] = value;
      if (canCache) rememberTranslation(item.key, value);
    });
  }

  return translations;
};

const collectTranslatableContent = (content) => {
  const container = document.createElement('div');
  container.innerHTML = sanitizeNotificationHtml(content || '');
  const textNodes = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const parent = node.parentElement;
    if (node.textContent.trim() && !parent?.closest('code')) textNodes.push(node);
    node = walker.nextNode();
  }

  return { container, textNodes };
};

const buildTranslationJobs = (items) => {
  const jobs = items.map((item) => {
    const { container, textNodes } = collectTranslatableContent(item.content);
    return { item, container, textNodes };
  });
  const texts = [];

  jobs.forEach(({ item, textNodes }) => {
    texts.push(item.title || '');
    textNodes.forEach((node) => texts.push(node.textContent));
  });

  return { jobs, texts };
};

const applyTranslations = (jobs, translations) => {
  const translatedById = {};
  let cursor = 0;

  jobs.forEach(({ item, container, textNodes }) => {
    const title = translations[cursor] || item.title;
    cursor += 1;

    textNodes.forEach((node) => {
      const translated = translations[cursor];
      cursor += 1;
      if (typeof translated === 'string' && translated.trim()) {
        node.textContent = translated;
      }
    });

    translatedById[item.id] = {
      title,
      content: container.innerHTML,
    };
  });

  return translatedById;
};

const playGentleNotificationChime = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.08); // A5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.15);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.35);
  } catch {
    // Audio context may be restricted by browser policy; fail silently.
  }
};

const formatNotificationTime = (dateValue, language) => {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  const time = date.getTime();
  if (Number.isNaN(time)) return '';

  const diffMs = Date.now() - time;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (language === 'vi') {
    if (diffSec < 45) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHour < 24) return `${diffHour} giờ trước`;
    if (diffDay === 1) return 'Hôm qua';
    if (diffDay < 7) return `${diffDay} ngày trước`;
  } else {
    if (diffSec < 45) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const NotificationTypeIcon = ({ type }) => {
  switch (type) {
    case 'task':
      return <Clock className='h-4 w-4 text-sky-500 dark:text-sky-400' />;
    case 'update':
      return <Sparkles className='h-4 w-4 text-violet-500 dark:text-violet-400' />;
    case 'welcome':
      return <Sparkles className='h-4 w-4 text-emerald-500 dark:text-emerald-400' />;
    default:
      return <Bell className='h-4 w-4 text-indigo-500 dark:text-indigo-400' />;
  }
};

const getSwipeActions = (filter, language) => {
  const deleteLabel = language === 'vi' ? 'Xóa' : 'Delete';
  const permanentDeleteLabel = language === 'vi' ? 'Xóa vĩnh viễn' : 'Delete';
  const restoreLabel = language === 'vi' ? 'Khôi phục' : 'Restore';

  const deleteAction = { key: 'trash', label: deleteLabel, icon: Trash2, tone: 'danger' };
  const permanentDeleteAction = {
    key: 'permanent-delete',
    label: permanentDeleteLabel,
    icon: Trash2,
    tone: 'danger',
  };
  const restoreAction = { key: 'restore', label: restoreLabel, icon: RotateCcw, tone: 'success' };

  if (filter === 'trash') {
    // In trash: left is restore (full green), right is permanent-delete (full red)
    return { left: restoreAction, right: permanentDeleteAction };
  }
  // Other filters: both left and right are delete (full red)
  return { left: deleteAction, right: deleteAction };
};

const SwipeableNotificationCard = ({
  notification,
  filter,
  language,
  onAction,
  onClick,
  isActiveSwipe,
  onSwipeStart,
  onSwipeEnd,
  children,
}) => {
  const containerRef = useRef(null);
  const x = useMotionValue(0);
  const { left, right } = getSwipeActions(filter, language);
  const leftWidth = left ? SWIPE_ACTION_WIDTH : 0;
  const rightWidth = right ? SWIPE_ACTION_WIDTH : 0;
  const suppressClickRef = useRef(false);

  const snapTo = useCallback((value) => {
    animate(x, value, { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 });
  }, [x]);

  useEffect(() => {
    if (!isActiveSwipe) {
      snapTo(0);
      return undefined;
    }

    const handlePointerDownOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        snapTo(0);
        onSwipeEnd?.(notification.id, false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDownOutside);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isActiveSwipe, notification.id, onSwipeEnd, snapTo]);

  const handleDragStart = () => {
    suppressClickRef.current = true;
    onSwipeStart?.(notification.id);
  };

  const handleDragEnd = (_, info) => {
    const projected = x.get() + info.velocity.x * 0.18;
    const leftThreshold = Math.min(leftWidth * 0.45, SWIPE_ACTION_WIDTH * 0.6);
    const rightThreshold = Math.min(rightWidth * 0.45, SWIPE_ACTION_WIDTH * 0.6);
    const next =
      projected > leftThreshold
        ? leftWidth
        : projected < -rightThreshold
        ? -rightWidth
        : 0;
    snapTo(next);
    onSwipeEnd?.(notification.id, next !== 0);
  };

  const handleCardClick = (event) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
      return;
    }
    if (Math.abs(x.get()) > 1) {
      event.preventDefault();
      event.stopPropagation();
      snapTo(0);
      onSwipeEnd?.(notification.id, false);
      return;
    }
    onClick?.(event);
  };

  const handleCardKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (Math.abs(x.get()) > 1) {
      snapTo(0);
      onSwipeEnd?.(notification.id, false);
      return;
    }
    onClick?.(event);
  };

  return (
    <div ref={containerRef} data-swipeable-card='true' className='group relative overflow-hidden rounded-3xl transition-shadow duration-300 ease-out group-hover:shadow-[0_12px_32px_rgba(124,58,237,0.18)] dark:group-hover:shadow-[0_12px_32px_rgba(76,29,149,0.35)]'>
      {left ? (
        <SwipeActionBackground
          x={x}
          side='left'
          action={left}
          actionWidth={SWIPE_ACTION_WIDTH}
          onAction={(actionKey) => onAction(notification, actionKey)}
        />
      ) : null}
      {right ? (
        <SwipeActionBackground
          x={x}
          side='right'
          action={right}
          actionWidth={SWIPE_ACTION_WIDTH}
          onAction={(actionKey) => onAction(notification, actionKey)}
        />
      ) : null}
      <motion.div
        drag='x'
        dragDirectionLock
        dragConstraints={{ left: -rightWidth, right: leftWidth }}
        dragElastic={0.12}
        dragMomentum={false}
        whileTap={{ scale: 0.995 }}
        style={{ x, touchAction: 'pan-y' }}
        onPointerDown={() => {
          suppressClickRef.current = false;
        }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        role='button'
        tabIndex={0}
        aria-label={notification.title}
        className='relative z-10 w-full cursor-pointer rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
      >
        {children}
      </motion.div>
    </div>
  );
};

const NotificationCardSkeleton = () => (
  <div className='space-y-3 p-1'>
    {[1, 2, 3].map((key) => (
      <div
        key={key}
        className='relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 p-4 shadow-xs backdrop-blur-sm dark:border-white/[0.06] dark:bg-slate-900/60'
      >
        <div className='flex items-start gap-3.5'>
          <div className='h-9 w-9 shrink-0 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800' />
          <div className='min-w-0 flex-1 space-y-2'>
            <div className='h-4 w-3/4 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800' />
            <div className='h-3 w-full animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800/60' />
            <div className='h-2.5 w-1/3 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800/40' />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const NotificationContentPreview = memo(function NotificationContentPreview({ html }) {
  const sanitized = useMemo(() => sanitizeNotificationHtml(html || ''), [html]);

  return (
    <div
      className='notification-rich-content mt-1 block overflow-hidden text-xs leading-relaxed text-slate-500 dark:text-slate-400'
      style={{
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: 2,
        overflow: 'hidden',
      }}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
});

const NotificationCenter = ({
  userId,
  navigationOpen = false,
  onDrawerOpenChange = () => {},
}) => {
  const { t, language } = useLanguage();
  const searchInputId = useId();

  const [unreadCount, setUnreadCount] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [notifications, setNotifications] = useState([]);
  const [translatedNotifications, setTranslatedNotifications] = useState({});
  const [translatedDetail, setTranslatedDetail] = useState(null);

  const [initialLoading, setInitialLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [listError, setListError] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const selectedIdRef = useRef(null);

  const [newArrivalIds, setNewArrivalIds] = useState(new Set());
  const [activeSwipeId, setActiveSwipeId] = useState(null);
  const [isDraggingDrawer, setIsDraggingDrawer] = useState(false);

  const notificationButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const detailRef = useRef(null);
  const drawerSyncTimer = useRef(null);
  const swipeStart = useRef(null);
  const knownNotificationIdsRef = useRef(new Set());
  const hasInitializedKnownIds = useRef(false);

  const drawerX = useMotionValue(
    typeof window === 'undefined' ? 360 : Math.min(360, window.innerWidth * 0.92)
  );
  const getDrawerWidth = () => Math.min(360, window.innerWidth * 0.92);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => () => {
    if (drawerSyncTimer.current) window.clearTimeout(drawerSyncTimer.current);
  }, []);

  useEffect(() => {
    onDrawerOpenChange(drawerOpen);
  }, [drawerOpen, onDrawerOpenChange]);

  useEffect(() => {
    if (isDraggingDrawer) return undefined;
    const controls = animate(drawerX, drawerOpen ? 0 : getDrawerWidth(), {
      duration: 0.24,
      ease: [0.2, 0.8, 0.2, 1],
    });
    return () => controls.stop();
  }, [drawerOpen, isDraggingDrawer, drawerX]);

  // Touch gesture to drag drawer open (right-to-left) and closed (left-to-right)
  useEffect(() => {
    const isInsideSwipeableCard = (target) =>
      Boolean(target?.closest?.('[data-swipeable-card]'));

    const onTouchStart = (event) => {
      if (
        navigationOpen ||
        isDraggingDrawer ||
        selectedId ||
        !event.touches.length
      ) {
        swipeStart.current = null;
        return;
      }
      const touch = event.touches[0];
      swipeStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        horizontal: false,
        wasOpen: drawerOpen,
        startOffset: drawerOpen ? 0 : getDrawerWidth(),
        onCard: isInsideSwipeableCard(event.target),
      };
    };

    const onTouchMove = (event) => {
      const start = swipeStart.current;
      if (!start || navigationOpen || selectedId || !event.touches.length) return;
      const touch = event.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;

      if (!start.horizontal) {
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
          swipeStart.current = null;
          return;
        }
        if (Math.abs(dx) <= 8) return;
        // Right-to-left opens the drawer; left-to-right closes it.
        if ((!start.wasOpen && dx > 0) || (start.wasOpen && dx < 0)) {
          swipeStart.current = null;
          return;
        }
        // Notification cards handle their own horizontal swipe actions.
        if (start.onCard) {
          swipeStart.current = null;
          return;
        }
        start.horizontal = true;
        setIsDraggingDrawer(true);
        if (!start.wasOpen) setFilter('all');
      }
      if (event.cancelable) event.preventDefault();
      const width = getDrawerWidth();
      drawerX.set(Math.max(0, Math.min(width, start.startOffset + dx)));
    };

    const onTouchEnd = (event) => {
      const start = swipeStart.current;
      if (!start) return;
      swipeStart.current = null;
      if (!start.horizontal || !event.changedTouches.length) return;
      const width = getDrawerWidth();
      const current = drawerX.get();
      const shouldOpen = start.wasOpen
        ? current < width * 0.3
        : current < width * 0.7;
      setIsDraggingDrawer(false);
      setDrawerOpen(shouldOpen);
    };

    const onTouchCancel = () => {
      const start = swipeStart.current;
      if (!start?.horizontal) {
        swipeStart.current = null;
        return;
      }
      swipeStart.current = null;
      setIsDraggingDrawer(false);
      setDrawerOpen(start.wasOpen);
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
    try {
      const response = await fetchUnreadNotificationCount();
      const newCount = response.data.count ?? 0;
      setUnreadCount(newCount);
    } catch {
      // Quietly ignore background count error
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;

    return openNotificationEventStream((event) => {
      if (event?.type !== 'notification-deleted' || !event.notificationId) return;
      const notificationId = String(event.notificationId);

      knownNotificationIdsRef.current.delete(notificationId);
      setNewArrivalIds((current) => {
        if (!current.has(notificationId)) return current;
        const next = new Set(current);
        next.delete(notificationId);
        return next;
      });
      setNotifications((items) => items.filter((item) => item.id !== notificationId));

      if (selectedIdRef.current === notificationId) {
        selectedIdRef.current = null;
        setSelectedId(null);
        setDetail(null);
        setTranslatedDetail(null);
        setDetailError('');
        setDetailLoading(false);
      }

      void refreshCount();
    });
  }, [userId, refreshCount]);

  const openNotification = useCallback(
    async (notificationId) => {
      setActiveSwipeId(null);
      setDrawerOpen(false);
      setSelectedId(notificationId);
      setDetail(null);
      setTranslatedDetail(null);
      setDetailError('');
      setDetailLoading(true);

      // Optimistic mark as read in current list
      setNotifications((items) =>
        items.map((item) =>
          item.id === notificationId
            ? { ...item, isRead: true, readAt: new Date().toISOString() }
            : item
        )
      );

      try {
        const readResponse = await markNotificationRead(notificationId);
        setNotifications((items) =>
          items.map((item) =>
            item.id === notificationId
              ? { ...item, isRead: true, readAt: readResponse.data.readAt }
              : item
          )
        );
        const response = await fetchNotification(notificationId);
        setDetail(response.data.notification);
        void refreshCount();
      } catch (error) {
        setDetailError(error.response?.data?.message || t.notificationDetailsLoadError);
      } finally {
        setDetailLoading(false);
      }
    },
    [refreshCount, t.notificationDetailsLoadError]
  );

  // Shows rich modern toast for a newly arrived notification when drawer is closed
  const triggerNotificationToast = useCallback(
    (notification) => {
      playGentleNotificationChime();
      const plainContent = notification.content
        ? notification.content.replace(/<[^>]*>/g, '').trim()
        : '';

      toast.custom(
        (toastId) => (
          <div
            role='alert'
            className='flex w-[min(380px,94vw)] items-start gap-3.5 rounded-3xl border border-violet-200/90 bg-white/95 p-4 shadow-[0_20px_50px_rgba(124,58,237,0.18)] backdrop-blur-xl transition-all duration-200 hover:shadow-[0_24px_60px_rgba(124,58,237,0.24)] dark:border-violet-500/30 dark:bg-slate-900/95 dark:text-slate-100 dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]'
          >
            <div className='relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-blue-600 text-white shadow-md shadow-violet-500/30'>
              <NotificationTypeIcon type={notification.type} />
              <span className='absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-3xl border-2 border-white bg-rose-500 dark:border-slate-900' />
            </div>

            <div className='min-w-0 flex-1'>
              <div className='flex items-center justify-between gap-1'>
                <span className='text-[10px] font-extrabold uppercase tracking-wider text-violet-600 dark:text-violet-400'>
                  {t.newNotificationReceived || 'Thông báo mới'}
                </span>
                <button
                  type='button'
                  onClick={() => toast.dismiss(toastId)}
                  className='flex h-6 w-6 items-center justify-center rounded-3xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                  aria-label={t.close}
                >
                  <X className='h-3.5 w-3.5' />
                </button>
              </div>

              <h4 className='mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-white'>
                {notification.title}
              </h4>

              {plainContent ? (
                <p className='mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400'>
                  {plainContent}
                </p>
              ) : null}

              <div className='mt-3 flex items-center gap-2'>
                <button
                  type='button'
                  onClick={() => {
                    toast.dismiss(toastId);
                    setDrawerOpen(true);
                    setFilter('all');
                    void openNotification(notification.id);
                  }}
                  className='flex items-center gap-1.5 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-violet-600/30 transition hover:from-violet-700 hover:to-indigo-700 active:scale-95'
                >
                  <span>{t.viewAction || 'Xem'}</span>
                </button>
                <button
                  type='button'
                  onClick={async () => {
                    toast.dismiss(toastId);
                    await markNotificationRead(notification.id).catch(() => {});
                    setNotifications((items) =>
                      items.map((item) =>
                        item.id === notification.id
                          ? { ...item, isRead: true, readAt: new Date().toISOString() }
                          : item
                      )
                    );
                    void refreshCount();
                  }}
                  className='rounded-3xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                >
                  {t.read || 'Đã đọc'}
                </button>
              </div>
            </div>
          </div>
        ),
        { duration: 7500 }
      );
    },
    [t, refreshCount, openNotification]
  );

  // Silent & intelligent notification refresh (no whole-screen spinning loaders!)
  const syncNotifications = useCallback(
    async (targetFilter = filter, silent = false) => {
      if (!userId) return;
      if (!silent) {
        // Only set initialLoading when there are no items currently rendered
        setInitialLoading(notifications.length === 0);
      } else {
        setIsSyncing(true);
      }
      setListError('');

      try {
        const response = await fetchNotifications(targetFilter);
        const incoming = response.data.notifications || [];

        // Check for new arrivals compared to known IDs
        if (!hasInitializedKnownIds.current) {
          incoming.forEach((n) => knownNotificationIdsRef.current.add(n.id));
          hasInitializedKnownIds.current = true;
        } else {
          const freshArrivals = incoming.filter(
            (n) => !knownNotificationIdsRef.current.has(n.id) && !n.isRead
          );
          if (freshArrivals.length > 0) {
            freshArrivals.forEach((n) => knownNotificationIdsRef.current.add(n.id));
            const freshIds = new Set(freshArrivals.map((n) => n.id));
            setNewArrivalIds((prev) => new Set([...prev, ...freshIds]));

            // If drawer is closed, show a toast for the latest one
            if (!drawerOpen) {
              triggerNotificationToast(freshArrivals[0]);
            } else {
              playGentleNotificationChime();
            }

            // Remove pulse highlight after 4 seconds
            window.setTimeout(() => {
              setNewArrivalIds((prev) => {
                const next = new Set(prev);
                freshIds.forEach((id) => next.delete(id));
                return next;
              });
            }, 4000);
          }
        }

        setNotifications(incoming);
      } catch {
        if (!silent || notifications.length === 0) {
          setListError(t.notificationsLoadError);
        }
      } finally {
        setInitialLoading(false);
        setIsSyncing(false);
      }
    },
    [userId, filter, notifications.length, drawerOpen, triggerNotificationToast, t.notificationsLoadError]
  );

  // Initial fetch on mount & background polling (never spinning whole list!)
  useEffect(() => {
    if (!userId) return undefined;

    const initialFetchTimer = window.setTimeout(() => {
      void refreshCount();
      void syncNotifications(filter, false);
    }, 0);

    // Silent background sync interval (every 18s)
    const syncTimer = window.setInterval(() => {
      void refreshCount();
      if (drawerOpen) {
        void syncNotifications(filter, true);
      }
    }, 18_000);

    // Sync on tab re-focus & online
    const onWindowFocus = () => {
      void refreshCount();
      if (drawerOpen) void syncNotifications(filter, true);
    };

    const onOnline = () => {
      void refreshCount();
      void syncNotifications(filter, true);
    };

    // External trigger to open drawer to a specific notification (e.g. from toast or app event)
    const onExternalOpen = (event) => {
      const targetNotificationId = event.detail?.notificationId;
      setDrawerOpen(true);
      setFilter('all');
      if (targetNotificationId) {
        void openNotification(targetNotificationId);
      }
    };

    // External notification created (e.g., from reminder watcher)
    const onExternalNotificationCreated = () => {
      void refreshCount();
      void syncNotifications(filter, true);
    };

    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('online', onOnline);
    window.addEventListener('todo-open-notifications', onExternalOpen);
    window.addEventListener('todo-notification-created', onExternalNotificationCreated);

    return () => {
      window.clearTimeout(initialFetchTimer);
      window.clearInterval(syncTimer);
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('todo-open-notifications', onExternalOpen);
      window.removeEventListener('todo-notification-created', onExternalNotificationCreated);
    };
  }, [userId, drawerOpen, filter, refreshCount, syncNotifications, openNotification]);

  // Translate list notifications on language change
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

    const { jobs, texts } = buildTranslationJobs(notifications);

    void translateTextsInBatches(texts, language)
      .then((translations) => {
        if (!active || !Array.isArray(translations)) return;
        setTranslatedNotifications(applyTranslations(jobs, translations));
      })
      .catch(() => {
        if (active) setTranslatedNotifications({});
      });

    return () => {
      active = false;
    };
  }, [language, notifications]);

  // Translate detail modal on language change
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

    const { jobs, texts } = buildTranslationJobs([detail]);

    void translateTextsInBatches(texts, language)
      .then((translations) => {
        if (active && Array.isArray(translations)) {
          const translated = applyTranslations(jobs, translations);
          setTranslatedDetail(translated[detail.id] || Object.values(translated)[0] || null);
        }
      })
      .catch(() => {
        if (active) setTranslatedDetail(null);
      });

    return () => {
      active = false;
    };
  }, [detail, language]);

  // Prevent background scroll when drawer or detail modal is active
  useEffect(() => {
    if (!drawerOpen && !selectedId) return undefined;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [drawerOpen, selectedId]);

  // Accessibility keyboard focus trap & Escape handling
  useEffect(() => {
    if (!drawerOpen && !selectedId) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Tab') {
        const dialog = selectedId ? detailRef.current : drawerRef.current;
        const focusable = dialog?.querySelectorAll(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
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

  // Mark all notifications as read (Optimistic)
  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || notifications.length === 0) return;
    const previousNotifications = notifications;
    const previousCount = unreadCount;

    // Optimistic update
    setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);

    try {
      await markAllNotificationsRead();
      toast.success(t.allMarkedRead || 'Đã đánh dấu tất cả thông báo là đã đọc');
    } catch {
      // Rollback on failure
      setNotifications(previousNotifications);
      setUnreadCount(previousCount);
      toast.error(t.notificationReadError);
    }
  };

  // Notification action handler (Trash, Restore, Permanent-delete) with Optimistic UI & Undo
  const handleNotificationAction = async (notification, action) => {
    const previousItem = notification;
    setActiveSwipeId(null);

    // Optimistic removal from visible list
    setNotifications((items) => items.filter((item) => item.id !== notification.id));

    if (!previousItem.isRead && (action === 'trash' || action === 'permanent-delete')) {
      setUnreadCount((count) => (typeof count === 'number' ? Math.max(0, count - 1) : count));
    }

    try {
      await updateNotificationState(notification.id, action);

      if (action === 'trash') {
        toast(t.notificationMovedToTrash || 'Đã chuyển vào thùng rác', {
          action: {
            label: t.undoAction || 'Hoàn tác',
            onClick: async () => {
              try {
                await updateNotificationState(notification.id, 'restore');
                setNotifications((items) => [previousItem, ...items]);
                if (!previousItem.isRead) {
                  setUnreadCount((c) => (typeof c === 'number' ? c + 1 : c));
                }
                toast.success(t.notificationRestored || 'Đã khôi phục thông báo');
              } catch {
                toast.error(t.notificationReadError);
              }
            },
          },
        });
      } else if (action === 'restore') {
        toast.success(t.notificationRestored || 'Đã khôi phục thông báo');
      } else if (action === 'permanent-delete') {
        toast.success(t.notificationDeletedPermanently || 'Đã xóa vĩnh viễn thông báo');
      }

      void refreshCount();
    } catch {
      // Rollback on failure
      setNotifications((items) =>
        items.some((item) => item.id === notification.id) ? items : [previousItem, ...items]
      );
      if (!previousItem.isRead && (action === 'trash' || action === 'permanent-delete')) {
        setUnreadCount((count) => (typeof count === 'number' ? count + 1 : count));
      }
      toast.error(t.notificationReadError);
    }
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setActiveSwipeId(null);
    setSearchQuery('');
    void syncNotifications(newFilter, false);
  };

  // Filter & client-side search logic
  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) return notifications;
    const query = searchQuery.trim().toLowerCase();
    return notifications.filter((item) => {
      const title = (translatedNotifications[item.id]?.title || item.title || '').toLowerCase();
      const content = (translatedNotifications[item.id]?.content || item.content || '').toLowerCase();
      return title.includes(query) || content.includes(query);
    });
  }, [notifications, searchQuery, translatedNotifications]);

  const openDrawer = () => {
    setActiveSwipeId(null);
    setDrawerOpen(true);
    if (drawerSyncTimer.current) window.clearTimeout(drawerSyncTimer.current);
    drawerSyncTimer.current = window.setTimeout(() => {
      drawerSyncTimer.current = null;
      void syncNotifications(filter, false);
    }, 260);
  };

  return (
    <>
      {/* Notification Bell Button */}
      <motion.button
        ref={notificationButtonRef}
        type='button'
        onClick={() => {
          if (!navigationOpen) openDrawer();
        }}
        disabled={navigationOpen}
        aria-disabled={navigationOpen}
        aria-label={`${t.notifications}${
          unreadCount > 0 ? `, ${unreadCount} ${t.unreadNotifications.toLowerCase()}` : ''
        }`}
        whileTap={{ scale: 0.92 }}
        className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl border border-violet-300/70 bg-white/85 text-violet-700 shadow-md backdrop-blur-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/25 dark:border-violet-500/30 dark:bg-slate-900/85 dark:text-violet-200 ${
          navigationOpen
            ? 'cursor-not-allowed opacity-40'
            : 'hover:bg-violet-50 hover:shadow-lg dark:hover:bg-violet-500/10'
        }`}
      >
        <Bell className='h-5 w-5' />
        <AnimatePresence>
          {unreadCount > 0 ? (
            <motion.span
              key='badge'
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className='absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-3xl border-2 border-white bg-rose-500 px-1.5 text-[10px] font-extrabold leading-none text-white shadow-sm dark:border-slate-900'
              aria-hidden='true'
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </motion.button>

      {/* Drawer Overlay & Sidebar */}
      <AnimatePresence>
        {drawerOpen || isDraggingDrawer ? (
          <>
            <motion.button
              type='button'
              aria-label={t.close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='fixed inset-0 z-[60] cursor-default bg-slate-950/50 backdrop-blur-none md:backdrop-blur-xs'
              onClick={() => {
                setDrawerOpen(false);
                focusNotificationButton();
              }}
            />

            <motion.aside
              ref={drawerRef}
              role='dialog'
              aria-modal='true'
              aria-labelledby='notification-drawer-title'
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='fixed inset-y-0 right-0 z-[61] flex w-[min(380px,94vw)] transform-gpu flex-col rounded-l-3xl border-l border-white/70 bg-[linear-gradient(155deg,#ffffff_0%,#f8f9ff_48%,#f1f5ff_100%)] shadow-[0_24px_80px_rgba(15,23,42,0.28)] will-change-transform dark:border-white/10 dark:bg-[linear-gradient(155deg,#111827_0%,#11152b_52%,#101b32_100%)]'
              style={{
                x: drawerX,
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
              {/* Drawer Header */}
              <header className='relative flex shrink-0 items-center justify-between gap-2 overflow-hidden border-b border-violet-200/50 bg-[linear-gradient(120deg,rgba(124,58,237,0.10),rgba(59,130,246,0.08),transparent)] px-5 py-4 dark:border-white/10 dark:bg-[linear-gradient(120deg,rgba(139,92,246,0.18),rgba(59,130,246,0.12),transparent)] sm:px-6'>
                <div className='min-w-0'>
                  <div className='flex items-center gap-2'>
                    <h2
                      id='notification-drawer-title'
                      className='truncate bg-gradient-to-r from-violet-700 via-indigo-600 to-blue-600 bg-clip-text text-xl font-extrabold tracking-tight text-transparent dark:from-violet-200 dark:via-indigo-200 dark:to-sky-200'
                    >
                      {t.notifications}
                    </h2>
                    {isSyncing ? (
                      <LoaderCircle
                        className='h-3.5 w-3.5 animate-spin text-violet-500/70'
                        aria-label={t.loading}
                      />
                    ) : null}
                  </div>
                  {unreadCount > 0 ? (
                    <p className='mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400'>
                      {unreadCount} {t.unreadNotifications.toLowerCase()}
                    </p>
                  ) : null}
                </div>

                <div className='flex shrink-0 items-center gap-1.5'>
                  {/* Mark all as read button */}
                  {unreadCount > 0 ? (
                    <button
                      type='button'
                      onClick={handleMarkAllRead}
                      title={t.markAllAsRead || 'Đánh dấu tất cả đã đọc'}
                      aria-label={t.markAllAsRead || 'Đánh dấu tất cả đã đọc'}
                      className='flex h-9 w-9 items-center justify-center rounded-3xl border border-violet-200/80 bg-white/80 text-violet-700 shadow-xs transition hover:bg-violet-50 active:scale-95 dark:border-violet-500/30 dark:bg-slate-900/80 dark:text-violet-200 dark:hover:bg-violet-500/10'
                    >
                      <CheckCheck className='h-4 w-4' />
                    </button>
                  ) : null}

                  {/* Close Drawer Button */}
                  <button
                    type='button'
                    autoFocus
                    onClick={() => {
                      setDrawerOpen(false);
                      focusNotificationButton();
                    }}
                    aria-label={t.close}
                    className='flex h-9 w-9 items-center justify-center rounded-3xl border border-violet-200/70 text-violet-700 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 active:scale-95 dark:border-violet-500/20 dark:text-violet-200 dark:hover:bg-violet-500/10'
                  >
                    <X className='h-4 w-4' />
                  </button>
                </div>
              </header>

              {/* Filter Tabs & Search Bar */}
              <div className='shrink-0 space-y-2 border-b border-violet-100/70 p-3 dark:border-white/[0.06] sm:px-4'>
                <div
                  className='grid grid-cols-4 gap-1 rounded-3xl border border-white/80 bg-white/70 p-1 shadow-inner shadow-slate-200/60 backdrop-blur-none sm:backdrop-blur-xl dark:border-white/[0.06] dark:bg-slate-950/45 dark:shadow-black/20'
                  role='tablist'
                  aria-label={t.notifications}
                >
                  {[
                    { key: 'all', label: t.allNotifications },
                    { key: 'unread', label: t.unreadNotifications },
                    { key: 'task', label: t.taskNotifications },
                    { key: 'trash', label: t.trash },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type='button'
                      role='tab'
                      aria-selected={filter === key}
                      onClick={() => handleFilterChange(key)}
                      className={`relative flex min-h-8.5 items-center justify-center rounded-3xl px-1.5 text-[11px] font-bold transition-all duration-200 ${
                        filter === key
                          ? 'text-white'
                          : 'text-slate-500 hover:-translate-y-0.5 hover:bg-white/[0] hover:text-violet-700 dark:text-slate-400 dark:hover:bg-white/[0] dark:hover:text-violet-200'
                      }`}
                    >
                      {filter === key ? (
                        <motion.span
                          layoutId='notification-filter-pill'
                          aria-hidden='true'
                          className='absolute inset-0 rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 shadow-md shadow-violet-500/30'
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        />
                      ) : null}
                      <span className='relative z-10 truncate'>{label}</span>
                    </button>
                  ))}
                </div>

                {/* Instant Search Bar */}
                {notifications.length > 2 || searchQuery ? (
                  <div className='relative flex items-center'>
                    <Search className='pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400 dark:text-slate-500' />
                    <input
                      id={searchInputId}
                      type='text'
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t.searchNotifications || 'Tìm kiếm thông báo…'}
                      className='h-8.5 w-full rounded-3xl border border-slate-200/80 bg-white/80 pl-8.5 pr-8 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-400/20 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-violet-500'
                    />
                    {searchQuery ? (
                      <button
                        type='button'
                        onClick={() => setSearchQuery('')}
                        aria-label='Clear search'
                        className='absolute right-2.5 flex h-4.5 w-4.5 items-center justify-center rounded-3xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                      >
                        <X className='h-3 w-3' />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Notifications List Area */}
              <div
                className='sidebar-scrollbar min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.055),transparent_58%)] px-3 py-3 [overscroll-behavior:contain] dark:bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.10),transparent_58%)] sm:px-4'
                style={{ touchAction: 'pan-y' }}
              >
                {initialLoading ? (
                  <NotificationCardSkeleton />
                ) : listError ? (
                  <div className='flex min-h-48 flex-col items-center justify-center gap-3 text-center'>
                    <p className='text-sm text-rose-600 dark:text-rose-300'>{listError}</p>
                    <button
                      type='button'
                      onClick={() => void syncNotifications(filter, false)}
                      className='min-h-10 rounded-3xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900'
                    >
                      {t.retry}
                    </button>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className='flex min-h-56 flex-col items-center justify-center px-6 text-center'>
                    <span className='mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-violet-100/70 text-violet-600 shadow-inner dark:bg-violet-500/15 dark:text-violet-300'>
                      {searchQuery ? (
                        <Search className='h-6 w-6' />
                      ) : filter === 'trash' ? (
                        <Trash2 className='h-6 w-6' />
                      ) : filter === 'unread' ? (
                        <Check className='h-6 w-6' />
                      ) : filter === 'task' ? (
                        <Clock className='h-6 w-6' />
                      ) : (
                        <Bell className='h-6 w-6' />
                      )}
                    </span>
                    <p className='text-sm font-semibold text-slate-700 dark:text-slate-200'>
                      {searchQuery
                        ? t.noMatchingNotifications || 'Không tìm thấy thông báo phù hợp.'
                        : filter === 'task'
                        ? t.noTaskNotifications
                        : filter === 'unread'
                        ? t.noNotifications
                        : filter === 'trash'
                        ? t.trashEmpty || 'Thùng rác đang trống'
                        : t.noNotifications}
                    </p>
                    {searchQuery ? (
                      <button
                        type='button'
                        onClick={() => setSearchQuery('')}
                        className='mt-3 text-xs font-bold text-violet-600 hover:underline dark:text-violet-400'
                      >
                        {language === 'vi' ? 'Xóa từ khóa tìm kiếm' : 'Clear search'}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <ul className='space-y-2.5'>
                    <AnimatePresence initial={false}>
                      {filteredNotifications.map((notification) => {
                        const isJustArrived = newArrivalIds.has(notification.id);
                        return (
                          <motion.li
                            key={notification.id}
                            initial={isJustArrived ? { opacity: 0, y: -16, scale: 0.96 } : false}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{
                              opacity: 0,
                              x: -40,
                              height: 0,
                              marginBottom: 0,
                              transition: { duration: 0.22, ease: 'easeOut' },
                            }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className='overflow-hidden'
                          >
                            <SwipeableNotificationCard
                              notification={notification}
                              filter={filter}
                              language={language}
                              isActiveSwipe={activeSwipeId === notification.id}
                              onSwipeStart={(id) => setActiveSwipeId(id)}
                              onSwipeEnd={(id, hasOpen) => {
                                setActiveSwipeId(hasOpen ? id : null);
                              }}
                              onAction={handleNotificationAction}
                              onClick={() => void openNotification(notification.id)}
                            >
                              <div
                                className={`relative block w-full rounded-3xl border p-3.5 text-left transition-all duration-300 ease-out group-hover:border-violet-400/90 dark:group-hover:border-violet-400/60 ${
                                  isJustArrived
                                    ? 'ring-2 ring-violet-500/60 shadow-[0_0_24px_rgba(139,92,246,0.3)] '
                                    : ''
                                } ${
                                  notification.isRead
                                    ? 'border-slate-200/80 bg-white text-slate-600 dark:border-white/[0.07] dark:bg-slate-900/90 dark:text-slate-400'
                                    : 'border-violet-200/90 bg-[linear-gradient(120deg,rgba(245,243,255,0.98),rgba(239,246,255,0.92))] text-slate-900 shadow-[0_8px_24px_rgba(124,58,237,0.08)] dark:border-violet-400/25 dark:bg-[linear-gradient(120deg,rgba(139,92,246,0.18),rgba(59,130,246,0.14))] dark:text-slate-100'
                                }`}
                              >
                                <div className='flex items-start gap-3'>
                                  {/* Notification Type Icon / Avatar */}
                                  <div
                                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-3xl border shadow-xs ${
                                      notification.isRead
                                        ? 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400'
                                        : 'border-violet-200 bg-white text-violet-700 shadow-violet-500/10 dark:border-violet-500/30 dark:bg-slate-800 dark:text-violet-300'
                                    }`}
                                  >
                                    <NotificationTypeIcon type={notification.type} />
                                  </div>

                                  <div className='min-w-0 flex-1'>
                                    <div className='flex items-center justify-between gap-1'>
                                      <div
                                        className={`truncate text-sm ${
                                          notification.isRead ? 'font-medium' : 'font-bold text-slate-950 dark:text-white'
                                        }`}
                                      >
                                        {translatedNotifications[notification.id]?.title ||
                                          notification.title}
                                      </div>

                                      {/* Unread Glowing Dot or New Badge */}
                                      {isJustArrived ? (
                                        <span className='shrink-0 rounded-3xl bg-violet-600 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-white shadow-xs'>
                                          {language === 'vi' ? 'Mới' : 'New'}
                                        </span>
                                      ) : !notification.isRead ? (
                                        <span
                                          className='h-2.5 w-2.5 shrink-0 rounded-3xl bg-violet-600 shadow-xs shadow-violet-500/50 dark:bg-violet-400'
                                          aria-hidden='true'
                                        />
                                      ) : null}
                                    </div>

                                    {/* Content Preview */}
                                    <NotificationContentPreview
                                      html={
                                        translatedNotifications[notification.id]?.content ||
                                        notification.content
                                      }
                                    />

                                    {/* Footer: Time */}
                                    <div className='mt-2.5 flex items-center justify-between'>
                                      <span className='text-[11px] font-medium text-slate-400 dark:text-slate-500'>
                                        {formatNotificationTime(
                                          notification.createdAt || notification.deliveredAt,
                                          language
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </SwipeableNotificationCard>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                )}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {/* Detail Modal Dialog */}
      <AnimatePresence>
        {selectedId ? (
          <motion.div
            key='notification-detail-overlay'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:p-6'
            style={{
              paddingTop: 'max(1rem, env(safe-area-inset-top))',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            }}
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
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className='flex w-[min(620px,94vw)] max-h-[82dvh] min-h-[46dvh] flex-col overflow-hidden rounded-3xl border border-white/70 bg-[linear-gradient(145deg,#ffffff,#f8f7ff)] shadow-[0_28px_100px_rgba(15,23,42,0.32)] dark:border-white/10 dark:bg-[linear-gradient(145deg,#171b2d,#111827)]'
            >
              {/* Detail Header */}
              <header className='flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white/60 px-5 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/60 sm:px-6 sm:py-5'>
                <div className='min-w-0'>
                  <div className='flex items-center gap-2'>
                    <span className='flex h-6 items-center gap-1.5 rounded-3xl bg-violet-100 px-2.5 text-[11px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'>
                      <NotificationTypeIcon type={detail?.type} />
                      <span className='capitalize'>{detail?.type || t.notifications}</span>
                    </span>
                    {detail?.createdAt ? (
                      <span className='text-xs text-slate-400 dark:text-slate-500'>
                        {formatNotificationTime(detail.createdAt, language)}
                      </span>
                    ) : null}
                  </div>

                  <h2
                    id='notification-detail-title'
                    className='mt-2 select-text break-words text-lg font-bold leading-snug text-slate-900 dark:text-white sm:text-xl'
                  >
                    {translatedDetail?.title || detail?.title || t.notifications}
                  </h2>
                </div>

                <div className='flex shrink-0 items-center gap-2'>
                  <button
                    type='button'
                    autoFocus
                    onClick={() => {
                      setSelectedId(null);
                      setDetail(null);
                      focusNotificationButton();
                    }}
                    aria-label={t.close}
                    className='flex h-9 w-9 shrink-0 items-center justify-center rounded-3xl border border-violet-200/70 text-violet-700 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 active:scale-95 dark:border-violet-500/20 dark:text-violet-200 dark:hover:bg-violet-500/10'
                  >
                    <X className='h-4 w-4' />
                  </button>
                </div>
              </header>

              {/* Detail Body */}
              <div
                className='sidebar-scrollbar min-h-0 flex-1 select-text overflow-y-auto px-5 py-5 [&_*]:select-text [overscroll-behavior:contain] sm:px-6 sm:py-6'
                style={{ touchAction: 'pan-y' }}
              >
                {detailLoading ? (
                  <div className='flex min-h-36 items-center justify-center text-violet-600 dark:text-violet-300'>
                    <LoaderCircle className='h-7 w-7 animate-spin' />
                    <span className='sr-only'>{t.loading}</span>
                  </div>
                ) : detailError ? (
                  <div className='flex min-h-36 flex-col items-center justify-center gap-3 text-center'>
                    <p className='text-sm text-rose-600 dark:text-rose-300'>
                      {detailError || t.notificationReadError}
                    </p>
                    <button
                      type='button'
                      onClick={() => {
                        if (selectedId) void openNotification(selectedId);
                      }}
                      className='min-h-10 rounded-3xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                    >
                      {t.retry}
                    </button>
                  </div>
                ) : (
                  <div
                    className='notification-rich-content break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200'
                    dangerouslySetInnerHTML={{
                      __html: sanitizeNotificationHtml(
                        translatedDetail?.content || detail?.content || ''
                      ),
                    }}
                  />
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
