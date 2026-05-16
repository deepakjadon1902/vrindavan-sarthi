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

module.exports = {
  parseDateOnlyToUTC,
  isValidDate,
  rangesOverlap,
  daysBetween,
};

