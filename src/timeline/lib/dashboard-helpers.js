import { getTimelineText, resolveTimelineLocale } from "../../infra/i18n/timeline-locale.js";
import timezoneUtils from "../../infra/timeline/timezone-utils.js";

const {
  anchorClockRangeToReferenceDay,
  dateKeyTimeToIsoInTimezone,
  formatClockInTimezone,
  formatDateInTimezone,
  formatDayOfMonthInTimezone,
  formatMonthDayInTimezone,
  formatWeekdayInTimezone,
  minutesSinceMidnightInTimezone,
  offsetDateInTimezone,
  resolveTimelineTimezone,
} = timezoneUtils;

function buildMonthTimeline(data, monthKey) {
  if (!data || !monthKey) {
    return null;
  }
  const timezone = resolveTimelineTimezone(data?.meta?.timezone);
  const dates = (data?.meta?.availableDates || []).filter((date) => date.startsWith(monthKey)).sort();
  if (!dates.length) {
    return null;
  }
  const anchorDate = "2000-01-01";
  return {
    key: monthKey,
    label: monthKey,
    start: dateKeyTimeToIsoInTimezone(anchorDate, "00:00:00", timezone),
    end: dateKeyTimeToIsoInTimezone(anchorDate, "23:59:59", timezone),
    groups: dates.map((date) => ({
      id: date,
      content: formatMonthGroupLabel(date, timezone, data?.meta?.locale || "en"),
    })),
    items: dates.flatMap((date) => {
      const dayTimeline = data?.timelines?.day?.[date];
      const dayItems = Array.isArray(dayTimeline?.items) ? dayTimeline.items : [];
      return dayItems.map((item) => {
        const anchored = anchorItemRangeToReferenceDay(item.start, item.end, anchorDate, timezone);
        return {
          ...item,
          id: `${date}:${item.id}`,
          group: date,
          start: anchored.start,
          end: anchored.end,
          tooltip: {
            ...(item.tooltip || {}),
            dateText: date,
          },
        };
      });
    }),
  };
}

function anchorItemRangeToReferenceDay(startAt, endAt, anchorDate, timezone) {
  return anchorClockRangeToReferenceDay(startAt, endAt, anchorDate, timezone);
}

function formatMonthGroupLabel(date, timezone, locale = "en") {
  const resolvedLocale = resolveTimelineLocale(locale);
  const weekday = formatWeekdayInTimezone(`${date}T00:00:00`, timezone, resolvedLocale === "zh-CN" ? "zh-CN" : "en-US");
  return `${date.slice(5)} ${weekday}`;
}

function formatDateTime(value, locale = "en", timezone = "") {
  if (!value) {
    return getTimelineText(locale, "dateTimeNA");
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  const resolvedLocale = resolveTimelineLocale(locale);
  const resolvedTimezone = resolveTimelineTimezone(timezone);
  const dateText = formatDateInTimezone(parsed, resolvedTimezone);
  const clockText = formatClockInTimezone(parsed, resolvedTimezone);
  return `${dateText} ${clockText}`;
}

function formatRangeSelection(range, value, locale = "en") {
  if (!value) {
    return "";
  }
  if (range === "day") {
    return value;
  }
  if (range === "week") {
    return resolveTimelineLocale(locale) === "zh-CN"
      ? `${value} ${getTimelineText(locale, "weekOf")}`
      : `${getTimelineText(locale, "weekOf")} ${value}`;
  }
  return value;
}

function formatMinutes(value, locale = "en") {
  const minutes = Number(value || 0);
  if (!Number.isFinite(minutes)) {
    return resolveTimelineLocale(locale) === "zh-CN" ? `0${getTimelineText(locale, "minuteUnit")}` : "0 min";
  }
  if (minutes < 60) {
    return resolveTimelineLocale(locale) === "zh-CN"
      ? `${minutes}${getTimelineText(locale, "minuteUnit")}`
      : `${minutes} ${getTimelineText(locale, "minuteUnit")}`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (resolveTimelineLocale(locale) === "zh-CN") {
    return remaining
      ? `${hours}${getTimelineText(locale, "hourUnit")}${remaining}${getTimelineText(locale, "minuteUnit")}`
      : `${hours}${getTimelineText(locale, "hourUnit")}`;
  }
  return remaining ? `${hours} ${getTimelineText(locale, "hourUnit")} ${remaining} ${getTimelineText(locale, "minuteUnit")}` : `${hours} ${getTimelineText(locale, "hourUnit")}`;
}

function formatMinutesTick(value) {
  const minutes = Number(value || 0);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}

function formatCompactDuration(value) {
  const minutes = Math.max(0, Number(value || 0));
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours <= 0) {
    return `${remaining}m`;
  }
  if (remaining <= 0) {
    return `${hours}h`;
  }
  return `${hours}h${remaining}m`;
}

function formatPercent(value) {
  const percent = Number(value || 0) * 100;
  if (!Number.isFinite(percent)) {
    return "0%";
  }
  return `${percent >= 10 ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

function buildScaledDepthColor(color, ratio) {
  const normalized = Math.max(0, Math.min(1, Number(ratio || 0)));
  const curved = normalized ** 1.8;
  const colorWeight = Math.round(38 + (curved * 52));
  const whiteWeight = 100 - colorWeight;
  return `color-mix(in srgb, ${color} ${colorWeight}%, white ${whiteWeight}%)`;
}

function buildMobileTimelineEntries(timeline) {
  const items = Array.isArray(timeline?.items) ? timeline.items : [];
  return [...items]
    .sort((left, right) => Date.parse(left.start) - Date.parse(right.start))
    .map((item) => ({
      id: item.id,
      title: item.tooltip?.title || "",
      note: item.tooltip?.note || "",
      dateText: item.tooltip?.dateText || "",
      timeText: item.tooltip?.timeText || "",
      durationText: item.tooltip?.durationText || "",
      color: item.tooltip?.color || "var(--paper-edge)",
      ink: item.tooltip?.ink || "var(--ink)",
    }));
}

function buildMobileRecentWeekTimeline(data, locale = "en", anchorDate = "") {
  const timezone = resolveTimelineTimezone(data?.meta?.timezone);
  const allDates = [...(data?.meta?.availableDates || [])].sort();
  if (!anchorDate || !allDates.includes(anchorDate)) {
    return [];
  }
  const dates = allDates.filter((date) => date <= anchorDate).slice(-7);
  const resolvedLocale = resolveTimelineLocale(locale);
  return dates.map((date) => {
    const dayTimeline = data?.timelines?.day?.[date];
    const items = Array.isArray(dayTimeline?.items) ? dayTimeline.items : [];
    return {
      date,
      label: formatMobileDayLabel(date, timezone, resolvedLocale),
      weekday: formatMobileWeekdayEnglish(date, timezone),
      compactDay: formatMobileDayOfMonth(date, timezone),
      items: items
        .map((item) => ({
          id: item.id,
          title: item.tooltip?.title || "",
          note: item.tooltip?.note || "",
          timeText: item.tooltip?.timeText || "",
          durationText: item.tooltip?.durationText || "",
          color: item.tooltip?.color || "var(--paper-edge)",
          ink: item.tooltip?.ink || "var(--ink)",
          top: buildDayPosition(item.start, timezone),
          height: buildDayHeight(item.start, item.end),
        }))
        .sort((left, right) => left.top - right.top),
    };
  });
}

function buildMobileHourTicks() {
  return Array.from({ length: 25 }, (_, index) => ({
    key: `hour-${index}`,
    label: `${String(index % 24).padStart(2, "0")}:00`,
    top: (index / 24) * 100,
  }));
}

function buildDayPosition(startAt, timezone) {
  const minutes = minutesSinceMidnightInTimezone(startAt, timezone);
  return (minutes / (24 * 60)) * 100;
}

function buildDayHeight(startAt, endAt) {
  const duration = Math.max(20, durationMinutesFromIso(startAt, endAt));
  return (duration / (24 * 60)) * 100;
}

function durationMinutesFromIso(startAt, endAt) {
  return Math.max(0, Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60_000));
}

function formatMobileDayLabel(date, timezone, locale = "en") {
  return formatMonthDayInTimezone(`${date}T00:00:00`, timezone, locale === "zh-CN" ? "zh-CN" : "en-US");
}

function formatMobileWeekday(date, timezone, locale = "en") {
  return formatWeekdayInTimezone(`${date}T00:00:00`, timezone, locale === "zh-CN" ? "zh-CN" : "en-US");
}

function formatMobileWeekdayEnglish(date, timezone) {
  return formatWeekdayInTimezone(`${date}T00:00:00`, timezone, "en-US");
}

function formatMobileDayOfMonth(date, timezone) {
  return formatDayOfMonthInTimezone(`${date}T00:00:00`, timezone, "en-US");
}

export {
  buildMobileHourTicks,
  buildMobileRecentWeekTimeline,
  buildMobileTimelineEntries,
  buildMonthTimeline,
  buildScaledDepthColor,
  formatCompactDuration,
  formatDateTime,
  formatMinutes,
  formatMinutesTick,
  formatPercent,
  formatRangeSelection,
};
