import { useCallback, useMemo } from 'react';
import { dateKey, getCalendarDays, getCalendarRange } from '@/lib/calendarUtils';

const useCalendarNavigation = ({
  viewMode,
  selectedDate,
  setSelectedDate,
  locale,
}) => {
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) => ({
        value: month,
        label: new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2026, month, 1)),
      })),
    [locale]
  );

  const yearOptions = useMemo(
    () => Array.from({ length: 21 }, (_, index) => selectedDate.getFullYear() - 10 + index),
    [selectedDate]
  );

  const calendarDays = useMemo(
    () => getCalendarDays(viewMode === 'agenda' ? 'week' : viewMode, selectedDate),
    [viewMode, selectedDate]
  );
  const calendarDateKeys = useMemo(() => calendarDays.map(dateKey), [calendarDays]);
  const calendarRange = useMemo(() => getCalendarRange(calendarDays), [calendarDays]);

  const changePeriod = useCallback((direction) => {
    setSelectedDate((current) => {
      const next = new Date(current);
      if (viewMode === 'month') next.setMonth(next.getMonth() + direction);
      else if (viewMode === 'week' || viewMode === 'agenda')
        next.setDate(next.getDate() + direction * 7);
      else next.setDate(next.getDate() + direction);
      return next;
    });
  }, [setSelectedDate, viewMode]);

  const jumpToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, [setSelectedDate]);

  const periodLabel = useMemo(() => {
    if (viewMode === 'month') {
      return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
        selectedDate
      );
    }
    if (viewMode === 'week' || viewMode === 'agenda') {
      const first = calendarDays[0] || selectedDate;
      const last = calendarDays[6] || selectedDate;
      return `${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
        first
      )} – ${new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(last)}`;
    }
    return new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(selectedDate);
  }, [viewMode, locale, selectedDate, calendarDays]);

  return {
    monthOptions,
    yearOptions,
    calendarDays,
    calendarDateKeys,
    calendarRange,
    changePeriod,
    jumpToToday,
    periodLabel,
  };
};

export default useCalendarNavigation;
