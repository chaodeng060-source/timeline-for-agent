function resolveTimelineTimezone(timezone) {
  const normalized = String(timezone || "").trim();
  return normalized || "Asia/Shanghai";
}

function formatDateInTimezone(value, timezone) {
  return formatPartsInTimezone(value, resolveTimelineTimezone(timezone), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatClockInTimezone(value, timezone) {
  return formatPartsInTimezone(value, resolveTimelineTimezone(timezone), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatWeekdayInTimezone(value, timezone, locale = "en-US") {
  return formatPartsInTimezone(value, resolveTimelineTimezone(timezone), {
    weekday: "short",
  }, locale);
}

function formatMonthDayInTimezone(value, timezone, locale = "en-US") {
  return formatPartsInTimezone(value, resolveTimelineTimezone(timezone), {
    month: "numeric",
    day: "numeric",
  }, locale);
}

function formatDayOfMonthInTimezone(value, timezone, locale = "en-US") {
  return formatPartsInTimezone(value, resolveTimelineTimezone(timezone), {
    day: "numeric",
  }, locale);
}

function offsetDateInTimezone(date, dayDelta, timezone) {
  const midnight = parseDateKeyInTimezone(date, resolveTimelineTimezone(timezone));
  return formatDateInTimezone(midnight + dayDelta * 24 * 60 * 60 * 1000, timezone);
}

function dateKeyTimeToTimestamp(date, time, timezone) {
  return parseLocalDateTimeInTimezone(date, time, resolveTimelineTimezone(timezone));
}

function dateKeyTimeToIsoInTimezone(date, time, timezone) {
  const resolvedTimezone = resolveTimelineTimezone(timezone);
  return `${date}T${time}${offsetForTimezoneDateTime(date, time, resolvedTimezone)}`;
}

function getWeekStartInTimezone(date, timezone) {
  const resolvedTimezone = resolveTimelineTimezone(timezone);
  const weekdayLabel = formatWeekdayInTimezone(parseDateKeyInTimezone(date, resolvedTimezone), resolvedTimezone, "en-US");
  const weekdayMap = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = weekdayMap[weekdayLabel] ?? 0;
  return offsetDateInTimezone(date, -offset, resolvedTimezone);
}

function minutesSinceMidnightInTimezone(value, timezone) {
  const parsed = Date.parse(value);
  const resolvedTimezone = resolveTimelineTimezone(timezone);
  const hour = Number(formatPartsInTimezone(parsed, resolvedTimezone, {
    hour: "2-digit",
    hour12: false,
  }, "en-GB"));
  const minute = Number(formatPartsInTimezone(parsed, resolvedTimezone, {
    minute: "2-digit",
    hour12: false,
  }, "en-GB"));
  return (hour * 60) + minute;
}

function anchorClockRangeToReferenceDay(startAt, endAt, anchorDate, timezone) {
  const resolvedTimezone = resolveTimelineTimezone(timezone);
  const startClock = formatClockInTimezone(startAt, resolvedTimezone);
  const endClock = formatClockInTimezone(endAt, resolvedTimezone);
  let anchoredStart = dateKeyTimeToIsoInTimezone(anchorDate, `${startClock}:00`, resolvedTimezone);
  let anchoredEnd = dateKeyTimeToIsoInTimezone(anchorDate, `${endClock}:00`, resolvedTimezone);
  if (Date.parse(anchoredEnd) <= Date.parse(anchoredStart)) {
    anchoredEnd = dateKeyTimeToIsoInTimezone(offsetDateInTimezone(anchorDate, 1, resolvedTimezone), `${endClock}:00`, resolvedTimezone);
  }
  return { start: anchoredStart, end: anchoredEnd };
}

function parseDateKeyInTimezone(date, timezone) {
  return parseLocalDateTimeInTimezone(date, "00:00:00", resolveTimelineTimezone(timezone));
}

function offsetForTimezoneMidnight(date, timezone) {
  return offsetForTimezoneDateTime(date, "00:00:00", timezone);
}

function offsetForTimezoneDateTime(date, time, timezone) {
  const timestamp = parseLocalDateTimeInTimezone(date, time, timezone);
  const parts = partsForTimestampInTimezone(timestamp, timezone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMinutes = Math.round((asUtc - timestamp) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

function parseLocalDateTimeInTimezone(date, time, timezone) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second || 0);
  let guess = targetUtc;

  for (let index = 0; index < 4; index += 1) {
    const parts = partsForTimestampInTimezone(guess, timezone);
    const observedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const diff = targetUtc - observedUtc;
    if (diff === 0) {
      return guess;
    }
    guess += diff;
  }

  return guess;
}

function partsForTimestampInTimezone(timestamp, timezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return Object.fromEntries(formatter.formatToParts(timestamp).map((part) => [part.type, part.value]));
}

function formatPartsInTimezone(value, timezone, options, locale = "en-CA") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    ...options,
  }).format(typeof value === "number" ? value : Date.parse(value));
}

module.exports = {
  anchorClockRangeToReferenceDay,
  dateKeyTimeToIsoInTimezone,
  dateKeyTimeToTimestamp,
  formatClockInTimezone,
  formatDateInTimezone,
  formatDayOfMonthInTimezone,
  formatMonthDayInTimezone,
  formatWeekdayInTimezone,
  getWeekStartInTimezone,
  minutesSinceMidnightInTimezone,
  offsetDateInTimezone,
  resolveTimelineTimezone,
};
