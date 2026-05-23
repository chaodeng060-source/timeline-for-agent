const { getTimelineText, localizeTimelineTaxonomy, resolveTimelineLocale } = require("../i18n/timeline-locale");
const { buildCategoryTheme } = require("./category-theme");
const {
  anchorClockRangeToReferenceDay,
  dateKeyTimeToIsoInTimezone,
  dateKeyTimeToTimestamp,
  formatClockInTimezone,
  formatDateInTimezone,
  formatWeekdayInTimezone,
  getWeekStartInTimezone,
  offsetDateInTimezone,
  resolveTimelineTimezone,
} = require("./timezone-utils");

let activeLocale = "en";
let activeTimezone = resolveTimelineTimezone();

function buildTimelineViews(state, metaOverrides = {}, options = {}) {
  activeLocale = resolveTimelineLocale(options.locale || metaOverrides.locale || "en");
  activeTimezone = resolveTimelineTimezone(state.timezone || metaOverrides.timezone);
  const dates = Object.keys(state.facts || {}).sort();
  const localizedTaxonomy = localizeTimelineTaxonomy(state.taxonomy, activeLocale);
  const categoryMap = buildCategoryMap(localizedTaxonomy);
  const eventNodeMap = buildEventNodeMap(localizedTaxonomy);
  const dayTimelines = {};
  for (const date of dates) {
    dayTimelines[date] = buildDayTimeline(date, state.facts[date], categoryMap, eventNodeMap);
  }

  const weekRanges = buildWeekRanges(dates);
  const weekTimelines = {};
  for (const weekRange of weekRanges) {
    weekTimelines[weekRange.key] = buildWeekTimeline(weekRange, state.facts, categoryMap, eventNodeMap);
  }

  const rangeData = {
    day: buildDayRangeData(dates, state, categoryMap, eventNodeMap),
    week: buildWeekRangeData(weekRanges, state, categoryMap, eventNodeMap),
    month: buildMonthRangeData(dates, state, categoryMap, eventNodeMap),
  };

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      updatedAt: metaOverrides.updatedAt || "",
      taxonomyUpdatedAt: metaOverrides.taxonomyUpdatedAt || "",
      factsUpdatedAt: metaOverrides.factsUpdatedAt || "",
      isDemoData: Boolean(metaOverrides.isDemoData),
      timezone: activeTimezone,
      locale: activeLocale,
      availableDates: dates,
      latestDate: dates[dates.length - 1] || "",
    },
    taxonomy: {
      categories: localizedTaxonomy.categories,
      eventNodes: localizedTaxonomy.eventNodes,
    },
    timelines: {
      day: dayTimelines,
      week: weekTimelines,
    },
    ranges: rangeData,
  };
}

function buildDayTimeline(date, day, categoryMap) {
  const events = Array.isArray(day?.events) ? day.events : [];
  return {
    date,
    start: dateKeyTimeToIsoInTimezone(date, "00:00:00", activeTimezone),
    end: dateKeyTimeToIsoInTimezone(date, "23:59:59", activeTimezone),
    groups: [],
    items: events.map((event) => {
      const theme = categoryMap.get(event.subcategoryId) || categoryMap.get(event.categoryId) || resolveCategoryTheme(event.categoryId);
      return {
        id: event.id,
        start: event.startAt,
        end: event.endAt,
        content: buildTimelineItemContent(event),
        style: buildItemStyle(theme),
        tooltip: {
          title: event.title,
          note: event.note || "",
          color: theme.color,
          ink: theme.ink,
          durationText: formatMinutes(durationMinutes(event.startAt, event.endAt)),
          timeText: `${formatClockInTimezone(event.startAt, activeTimezone)} - ${formatClockInTimezone(event.endAt, activeTimezone)}`,
        },
        className: `cat-${event.categoryId}`,
      };
    }),
  };
}

function buildWeekTimeline(weekRange, facts, categoryMap) {
  const groups = weekRange.dates.map((date) => ({
    id: date,
    content: formatWeekday(date),
  }));
  const items = [];
  const anchorDate = "2000-01-01";
  for (const date of weekRange.dates) {
    const day = facts[date];
    for (const event of Array.isArray(day?.events) ? day.events : []) {
      const anchoredRange = anchorEventToReferenceDay(event.startAt, event.endAt, anchorDate);
      const theme = categoryMap.get(event.subcategoryId) || categoryMap.get(event.categoryId) || resolveCategoryTheme(event.categoryId);
      items.push({
        id: `${date}:${event.id}`,
        group: date,
        start: anchoredRange.start,
        end: anchoredRange.end,
        content: buildTimelineItemContent(event),
        style: buildItemStyle(theme),
        tooltip: {
          title: event.title,
          note: event.note || "",
          color: theme.color,
          ink: theme.ink,
          durationText: formatMinutes(durationMinutes(event.startAt, event.endAt)),
          timeText: `${formatClockInTimezone(event.startAt, activeTimezone)} - ${formatClockInTimezone(event.endAt, activeTimezone)}`,
          dateText: date,
        },
        className: `cat-${event.categoryId}`,
      });
    }
  }
  return {
    key: weekRange.key,
    label: weekRange.label,
    start: dateKeyTimeToIsoInTimezone(anchorDate, "00:00:00", activeTimezone),
    end: dateKeyTimeToIsoInTimezone(anchorDate, "23:59:59", activeTimezone),
    groups,
    items,
  };
}

function buildTimelineItemContent(event) {
  const durationText = formatCompactDuration(durationMinutes(event.startAt, event.endAt));
  return `${event.title} | ${durationText}`;
}

function buildDayRangeData(dates, state, categoryMap, eventNodeMap) {
  const output = {};
  for (const date of dates) {
    output[date] = buildDayAggregate(date, state.facts[date]?.events || [], categoryMap, eventNodeMap);
  }
  return output;
}

function buildWeekRangeData(weekRanges, state, categoryMap, eventNodeMap) {
  const output = {};
  for (const weekRange of weekRanges) {
    const events = [];
    for (const date of weekRange.dates) {
      events.push(...(state.facts[date]?.events || []));
    }
    output[weekRange.key] = buildRangeAggregate({
      key: weekRange.key,
      label: weekRange.label,
      unit: "day",
      events,
      categoryMap,
      eventNodeMap,
      allDates: weekRange.dates,
      timelineDates: weekRange.dates,
    });
  }
  return output;
}

function buildMonthRangeData(dates, state, categoryMap, eventNodeMap) {
  const grouped = new Map();
  for (const date of dates) {
    const monthKey = date.slice(0, 7);
    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, []);
    }
    grouped.get(monthKey).push(date);
  }
  const output = {};
  for (const [monthKey, monthDates] of grouped.entries()) {
    const events = [];
    for (const date of monthDates) {
      events.push(...(state.facts[date]?.events || []));
    }
    output[monthKey] = buildRangeAggregate({
      key: monthKey,
      label: monthKey,
      unit: "day",
      events,
      categoryMap,
      eventNodeMap,
      allDates: monthDates,
      timelineDates: monthDates,
    });
  }
  return output;
}

function buildRangeAggregate({ key, label, unit, events, categoryMap, eventNodeMap, allDates }) {
  const totalMinutes = events.reduce((sum, event) => sum + durationMinutes(event.startAt, event.endAt), 0);
  const categoryBuckets = new Map();
  const subcategoryBuckets = new Map();
  const subcategoryTrendBuckets = new Map();

  for (const date of allDates) {
    subcategoryTrendBuckets.set(date, new Map());
  }

  for (const event of events) {
    const minutes = durationMinutes(event.startAt, event.endAt);
    const category = categoryMap.get(event.categoryId);
    const subcategory = categoryMap.get(event.subcategoryId);
    const categoryId = event.categoryId;
    const dateKey = formatDateInTimezone(event.startAt, activeTimezone);

    upsertBucket(categoryBuckets, categoryId, {
      categoryId,
      label: category?.label || categoryId,
      color: category?.color || resolveCategoryTheme(categoryId).color,
      ink: category?.ink || resolveCategoryTheme(categoryId).ink,
      minutes: 0,
    }).minutes += minutes;

    if (event.subcategoryId) {
      upsertBucket(subcategoryBuckets, event.subcategoryId, {
        subcategoryId: event.subcategoryId,
        categoryId,
        label: subcategory?.label || event.subcategoryId,
        color: subcategory?.color || category?.color || resolveCategoryTheme(categoryId).color,
        ink: subcategory?.ink || category?.ink || resolveCategoryTheme(categoryId).ink,
        minutes: 0,
      }).minutes += minutes;
    }

    if (event.subcategoryId && subcategoryTrendBuckets.has(dateKey)) {
      const bucket = subcategoryTrendBuckets.get(dateKey);
      upsertBucket(bucket, event.subcategoryId, {
        subcategoryId: event.subcategoryId,
        minutes: 0,
      }).minutes += minutes;
    }
  }

  const categories = [...categoryBuckets.values()]
    .sort((left, right) => right.minutes - left.minutes)
    .map((bucket) => ({
      ...bucket,
      percent: totalMinutes > 0 ? Number((bucket.minutes / totalMinutes).toFixed(4)) : 0,
    }));

  const categoryDetails = {};
  for (const category of categories) {
    const relatedSubcategories = [...subcategoryBuckets.values()]
      .filter((subcategoryBucket) => subcategoryBucket.categoryId === category.categoryId)
      .sort((left, right) => right.minutes - left.minutes)
      .map((subcategoryBucket) => ({
        ...subcategoryBucket,
        percent: category.minutes > 0 ? Number((subcategoryBucket.minutes / category.minutes).toFixed(4)) : 0,
      }));
    const relatedEvents = buildEventBlocks(
      events.filter((event) => event.categoryId === category.categoryId),
      allDates.length > 1,
    );
    const trend = allDates.map((date) => {
      let minutes = 0;
      for (const event of events) {
        if (event.categoryId !== category.categoryId) {
          continue;
        }
        if (formatDateInTimezone(event.startAt, activeTimezone) === date) {
          minutes += durationMinutes(event.startAt, event.endAt);
        }
      }
      return { label: date.slice(5), key: date, minutes };
    });
    categoryDetails[category.categoryId] = {
      categoryId: category.categoryId,
      label: category.label,
      color: category.color,
      ink: category.ink,
      trend,
      subcategories: relatedSubcategories,
      events: relatedEvents,
    };
  }

  const subcategoryDetails = {};
  for (const subcategoryBucket of subcategoryBuckets.values()) {
    subcategoryDetails[subcategoryBucket.subcategoryId] = {
      subcategoryId: subcategoryBucket.subcategoryId,
      categoryId: subcategoryBucket.categoryId,
      label: subcategoryBucket.label,
      color: subcategoryBucket.color,
      ink: subcategoryBucket.ink,
      trend: allDates.map((date) => ({
        key: date,
        label: date.slice(5),
        minutes: subcategoryTrendBuckets.get(date)?.get(subcategoryBucket.subcategoryId)?.minutes || 0,
      })),
      events: buildEventBlocks(
        events.filter((event) => event.subcategoryId === subcategoryBucket.subcategoryId),
        allDates.length > 1,
      ),
    };
  }

  return {
    key,
    label,
    unit,
    totalMinutes,
    categories,
    categoryDetails,
    subcategoryDetails,
  };
}

function buildDayAggregate(date, events, categoryMap, eventNodeMap) {
  const base = buildRangeAggregate({
    key: date,
    label: date,
    unit: "hour",
    events,
    categoryMap,
    eventNodeMap,
    allDates: [date],
  });

  const categoryDetails = {};
  for (const category of base.categories) {
    categoryDetails[category.categoryId] = {
      ...base.categoryDetails[category.categoryId],
      trend: buildHourlyDistribution(events.filter((event) => event.categoryId === category.categoryId)),
    };
  }

  const subcategoryDetails = {};
  for (const subcategoryId of Object.keys(base.subcategoryDetails || {})) {
    subcategoryDetails[subcategoryId] = {
      ...base.subcategoryDetails[subcategoryId],
      trend: buildHourlyDistribution(events.filter((event) => event.subcategoryId === subcategoryId)),
    };
  }

  return {
    ...base,
    categoryDetails,
    subcategoryDetails,
  };
}

function buildCategoryMap(taxonomy) {
  const map = new Map();
  for (const category of Array.isArray(taxonomy?.categories) ? taxonomy.categories : []) {
    const theme = resolveCategoryTheme(category.id, category.color);
    map.set(category.id, {
      categoryId: category.id,
      label: category.label,
      color: theme.color,
      ink: theme.ink,
    });
    for (const child of Array.isArray(category.children) ? category.children : []) {
      map.set(child.id, {
        categoryId: category.id,
        label: child.label,
        color: theme.color,
        ink: theme.ink,
      });
    }
  }
  return map;
}

function buildEventNodeMap(taxonomy) {
  const map = new Map();
  for (const node of Array.isArray(taxonomy?.eventNodes) ? taxonomy.eventNodes : []) {
    map.set(node.id, node);
  }
  return map;
}

function buildWeekRanges(dates) {
  const grouped = new Map();
  for (const date of dates) {
    const startDate = getWeekStartInTimezone(date, activeTimezone);
    if (!grouped.has(startDate)) {
      grouped.set(startDate, []);
    }
    grouped.get(startDate).push(date);
  }
  return [...grouped.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([startDate, groupedDates]) => ({
      key: startDate,
      label: activeLocale === "zh-CN" ? `${startDate} ${getTimelineText(activeLocale, "weekOf")}` : `${getTimelineText(activeLocale, "weekOf")} ${startDate}`,
      start: dateKeyTimeToIsoInTimezone(startDate, "00:00:00", activeTimezone),
      end: dateKeyTimeToIsoInTimezone(offsetDateInTimezone(startDate, 7, activeTimezone), "00:00:00", activeTimezone),
      dates: fillWeekDates(startDate, groupedDates),
    }));
}

function fillWeekDates(startDate, existingDates) {
  const existing = new Set(existingDates);
  const dates = [];
  for (let index = 0; index < 7; index += 1) {
    const date = offsetDateInTimezone(startDate, index, activeTimezone);
    dates.push(existing.has(date) ? date : date);
  }
  return dates;
}

function formatWeekday(date) {
  return formatWeekdayInTimezone(dateKeyTimeToTimestamp(date, "00:00:00", activeTimezone), activeTimezone, activeLocale === "zh-CN" ? "zh-CN" : "en-US");
}

function buildItemStyle(theme) {
  return `--item-fill:${theme.color};--item-border:${theme.color};--item-text:${theme.ink};`;
}

function durationMinutes(startAt, endAt) {
  return Math.max(0, Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60_000));
}

function anchorEventToReferenceDay(startAt, endAt, anchorDate) {
  return anchorClockRangeToReferenceDay(startAt, endAt, anchorDate, activeTimezone);
}

function formatMinutes(minutes) {
  if (minutes < 60) {
    return activeLocale === "zh-CN"
      ? `${minutes}${getTimelineText(activeLocale, "minuteUnit")}`
      : `${minutes} ${getTimelineText(activeLocale, "minuteUnit")}`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (activeLocale === "zh-CN") {
    return remaining
      ? `${hours}${getTimelineText(activeLocale, "hourUnit")}${remaining}${getTimelineText(activeLocale, "minuteUnit")}`
      : `${hours}${getTimelineText(activeLocale, "hourUnit")}`;
  }
  return remaining
    ? `${hours} ${getTimelineText(activeLocale, "hourUnit")} ${remaining} ${getTimelineText(activeLocale, "minuteUnit")}`
    : `${hours} ${getTimelineText(activeLocale, "hourUnit")}`;
}

function formatCompactDuration(minutes) {
  const safeMinutes = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;
  if (hours <= 0) {
    return `${remaining}m`;
  }
  if (remaining <= 0) {
    return `${hours}h`;
  }
  return `${hours}h${remaining}m`;
}

function upsertBucket(map, key, createValue) {
  if (!map.has(key)) {
    map.set(key, createValue);
  }
  return map.get(key);
}

function buildHourlyDistribution(events) {
  const buckets = Array.from({ length: 24 }, (_, index) => ({
    key: String(index),
    label: `${String(index).padStart(2, "0")}:00`,
    minutes: 0,
  }));
  for (const event of events) {
    const start = Date.parse(event.startAt);
    const end = Date.parse(event.endAt);
    const eventDate = formatDateInTimezone(start, activeTimezone);
    for (let index = 0; index < 24; index += 1) {
      const hourStart = dateKeyTimeToTimestamp(eventDate, `${String(index).padStart(2, "0")}:00:00`, activeTimezone);
      const hourEnd = hourStart + 60 * 60 * 1000;
      const overlap = Math.max(0, Math.min(end, hourEnd) - Math.max(start, hourStart));
      buckets[index].minutes += Math.round(overlap / 60_000);
    }
  }
  return buckets;
}

function buildEventBlocks(events, includeDate) {
  return [...events]
    .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt))
    .map((event) => ({
      eventNodeId: event.id,
      label: event.title,
      dateLabel: includeDate ? formatDateInTimezone(event.startAt, activeTimezone).slice(5) : "",
      timeLabel: `${formatClockInTimezone(event.startAt, activeTimezone)} - ${formatClockInTimezone(event.endAt, activeTimezone)}`,
      compactDuration: formatCompactDuration(durationMinutes(event.startAt, event.endAt)),
      fullLabel: includeDate
        ? `${formatDateInTimezone(event.startAt, activeTimezone).slice(5)} ${formatClockInTimezone(event.startAt, activeTimezone)} - ${formatClockInTimezone(event.endAt, activeTimezone)} ${event.title}`
        : `${formatClockInTimezone(event.startAt, activeTimezone)} - ${formatClockInTimezone(event.endAt, activeTimezone)} ${event.title}`,
      note: event.note || "",
      status: event.eventNodeId ? "official" : "derived",
      categoryId: event.categoryId,
      subcategoryId: event.subcategoryId,
      subcategoryLabel: event.subcategoryId,
      minutes: durationMinutes(event.startAt, event.endAt),
    }));
}

function resolveCategoryTheme(categoryId, fallbackColor = "") {
  const theme = buildCategoryTheme(categoryId, fallbackColor);
  return {
    color: theme.fill,
    ink: theme.ink,
  };
}

module.exports = {
  buildTimelineViews,
};
