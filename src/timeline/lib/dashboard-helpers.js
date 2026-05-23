import { getTimelineText, resolveTimelineLocale } from "../../infra/i18n/timeline-locale.js";

function buildMonthTimeline(data, monthKey) {
  if (!data || !monthKey) {
    return null;
  }
  const dates = (data?.meta?.availableDates || []).filter((date) => date.startsWith(monthKey)).sort();
  if (!dates.length) {
    return null;
  }
  const anchorDate = "2000-01-01";
  return {
    key: monthKey,
    label: monthKey,
    start: `${anchorDate}T00:00:00.000+08:00`,
    end: `${anchorDate}T23:59:59.999+08:00`,
    groups: dates.map((date) => ({
      id: date,
      content: formatMonthGroupLabel(date, data?.meta?.locale || "en"),
    })),
    items: dates.flatMap((date) => {
      const dayTimeline = data?.timelines?.day?.[date];
      const dayItems = Array.isArray(dayTimeline?.items) ? dayTimeline.items : [];
      return dayItems.map((item) => {
        const anchored = anchorItemRangeToReferenceDay(item.start, item.end, anchorDate);
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

function anchorItemRangeToReferenceDay(startAt, endAt, anchorDate) {
  const startClock = formatClockFromIso(startAt);
  const endClock = formatClockFromIso(endAt);
  let anchoredStart = `${anchorDate}T${startClock}:00+08:00`;
  let anchoredEnd = `${anchorDate}T${endClock}:00+08:00`;
  if (Date.parse(anchoredEnd) <= Date.parse(anchoredStart)) {
    anchoredEnd = `${offsetShanghaiDate(anchorDate, 1)}T${endClock}:00+08:00`;
  }
  return { start: anchoredStart, end: anchoredEnd };
}

function formatMonthGroupLabel(date, locale = "en") {
  const resolvedLocale = resolveTimelineLocale(locale);
  const weekday = new Intl.DateTimeFormat(resolvedLocale === "zh-CN" ? "zh-CN" : "en-US", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
  }).format(Date.parse(`${date}T00:00:00+08:00`));
  return `${date.slice(5)} ${weekday}`;
}

function formatClockFromIso(value) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(Date.parse(value));
}

function offsetShanghaiDate(date, dayDelta) {
  const timestamp = Date.parse(`${date}T00:00:00+08:00`);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(timestamp + dayDelta * 24 * 60 * 60 * 1000);
}

function formatDateTime(value, locale = "en") {
  if (!value) {
    return getTimelineText(locale, "dateTimeNA");
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  const resolvedLocale = resolveTimelineLocale(locale);
  return new Intl.DateTimeFormat(resolvedLocale === "zh-CN" ? "zh-CN" : "en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
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
      label: formatMobileDayLabel(date, resolvedLocale),
      weekday: formatMobileWeekdayEnglish(date),
      compactDay: formatMobileDayOfMonth(date),
      items: items
        .map((item) => ({
          id: item.id,
          title: item.tooltip?.title || "",
          note: item.tooltip?.note || "",
          timeText: item.tooltip?.timeText || "",
          durationText: item.tooltip?.durationText || "",
          color: item.tooltip?.color || "var(--paper-edge)",
          ink: item.tooltip?.ink || "var(--ink)",
          top: buildDayPosition(item.start),
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

function buildDayPosition(startAt) {
  const minutes = minutesSinceShanghaiMidnight(startAt);
  return (minutes / (24 * 60)) * 100;
}

function buildDayHeight(startAt, endAt) {
  const duration = Math.max(20, durationMinutesFromIso(startAt, endAt));
  return (duration / (24 * 60)) * 100;
}

function durationMinutesFromIso(startAt, endAt) {
  return Math.max(0, Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60_000));
}

function minutesSinceShanghaiMidnight(value) {
  const parsed = Date.parse(value);
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    hour12: false,
  }).format(parsed));
  const minute = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    minute: "2-digit",
    hour12: false,
  }).format(parsed));
  return (hour * 60) + minute;
}

function formatMobileDayLabel(date, locale = "en") {
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
  }).format(Date.parse(`${date}T00:00:00+08:00`));
}

function formatMobileWeekday(date, locale = "en") {
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
  }).format(Date.parse(`${date}T00:00:00+08:00`));
}

function formatMobileWeekdayEnglish(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
  }).format(Date.parse(`${date}T00:00:00+08:00`));
}

function formatMobileDayOfMonth(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    day: "numeric",
  }).format(Date.parse(`${date}T00:00:00+08:00`));
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
