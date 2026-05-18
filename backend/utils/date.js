const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse a date-only string (YYYY-MM-DD) into a Date at 00:00:00.000Z.
 * Falls back to new Date(value) for ISO strings.
 */
const parseDateOnlyToUTC = (value) => {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00.000Z`);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const isValidDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());

/**
 * Booking overlap for [start, end) date ranges.
 * Overlaps when aStart < bEnd AND aEnd > bStart
 */
const rangesOverlap = (aStart, aEnd, bStart, bEnd) =>
  aStart < bEnd && aEnd > bStart;

const daysBetween = (start, end) => Math.max(0, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));

/**
 * Enumerate date-only boundaries for [start, end) where start/end are UTC midnights.
 * Returns an array of Date objects at 00:00:00.000Z for each day.
 */
const enumerateDatesUTC = (start, end) => {
  if (!isValidDate(start) || !isValidDate(end) || start >= end) return [];
  const out = [];
  for (let t = start.getTime(); t < end.getTime(); t += MS_PER_DAY) {
    out.push(new Date(t));
  }
  return out;
};

module.exports = {
  parseDateOnlyToUTC,
  isValidDate,
  rangesOverlap,
  daysBetween,
  enumerateDatesUTC,
};
