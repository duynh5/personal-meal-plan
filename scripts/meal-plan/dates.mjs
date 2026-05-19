export const timeZone = "Asia/Ho_Chi_Minh";

function pad(number) {
  return String(number).padStart(2, "0");
}

export function toIsoDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function toDisplayDate(date) {
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

export function makeUtcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getVietnamDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function currentVietnamDate(date = new Date()) {
  const parts = getVietnamDateParts(date);

  return makeUtcDate(Number(parts.year), Number(parts.month), Number(parts.day));
}

export function assertValidDate(value, label) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${label} must be a valid Date.`);
  }
}

function nextMondayOnOrAfter(date) {
  const weekday = date.getUTCDay();
  const daysUntilMonday = weekday === 1 ? 0 : (8 - weekday) % 7;

  return addDays(date, daysUntilMonday);
}

function mondayOfWeek(date) {
  const weekday = date.getUTCDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;

  return addDays(date, -daysSinceMonday);
}

export function planStartMonday(date) {
  const weekday = date.getUTCDay();

  if (weekday >= 1 && weekday <= 4) {
    return mondayOfWeek(date);
  }

  return nextMondayOnOrAfter(date);
}

export function listWeekdaysInRange(startDate, endDate) {
  const days = [];

  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    const weekday = date.getUTCDay();

    if (weekday >= 1 && weekday <= 5) {
      days.push(date);
    }
  }

  return days;
}

function weekKeyFor(date) {
  const monday = addDays(date, -(date.getUTCDay() - 1));
  return toIsoDate(monday);
}

export function groupByWeek(days) {
  const weeks = [];
  const byKey = new Map();

  for (const date of days) {
    const key = weekKeyFor(date);
    if (!byKey.has(key)) {
      const week = { key, days: [] };
      byKey.set(key, week);
      weeks.push(week);
    }
    byKey.get(key).days.push(date);
  }

  return weeks;
}
