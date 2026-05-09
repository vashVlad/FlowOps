/**
 * Business-hours time engine.
 * Rules: Monday–Friday, 9:00 AM–6:00 PM, local timezone.
 * All functions operate on the system's local timezone (warehouse floor).
 */

const BH_START = 9;   // 9:00 AM
const BH_END   = 18;  // 6:00 PM
const BH_HOURS = BH_END - BH_START;  // 9 hours per working day

export const BH_DAILY_MS = BH_HOURS * 3_600_000;

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6; // 0 = Sun, 6 = Sat
}

/**
 * Move `d` forward to the next business moment (Mon–Fri 09:00–18:00).
 * If already inside business hours, returns a copy unchanged.
 */
function clampToBusinessStart(input: Date): Date {
  const d = new Date(input);

  // Skip over weekends — advance to the next weekday at BH_START
  while (isWeekend(d)) {
    d.setDate(d.getDate() + 1);
    d.setHours(BH_START, 0, 0, 0);
    d.setMilliseconds(0);
  }

  // Clamp to business hours on a weekday
  const minutes = d.getHours() * 60 + d.getMinutes();
  if (minutes < BH_START * 60) {
    d.setHours(BH_START, 0, 0, 0);
    d.setMilliseconds(0);
  } else if (minutes >= BH_END * 60) {
    // After closing — move to the next business day
    d.setDate(d.getDate() + 1);
    while (isWeekend(d)) d.setDate(d.getDate() + 1);
    d.setHours(BH_START, 0, 0, 0);
    d.setMilliseconds(0);
  }

  return d;
}

function nextBusinessDayStart(d: Date): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  while (isWeekend(next)) next.setDate(next.getDate() + 1);
  next.setHours(BH_START, 0, 0, 0);
  next.setMilliseconds(0);
  return next;
}

/** True if the given moment falls within business hours. */
export function isBusinessHour(date: Date | string): boolean {
  const d = new Date(date);
  if (isWeekend(d)) return false;
  const minutes = d.getHours() * 60 + d.getMinutes();
  return minutes >= BH_START * 60 && minutes < BH_END * 60;
}

/**
 * Return the number of BUSINESS milliseconds between start and end.
 * Weekends and off-hours are excluded.
 *
 * Example: Friday 5:55 PM → Monday 9:30 AM = 5 min + 30 min = 35 min.
 */
export function calculateBusinessDuration(
  start: Date | string,
  end:   Date | string
): number {
  const endDate = new Date(end);
  let cur = clampToBusinessStart(new Date(start));

  if (cur >= endDate) return 0;

  let totalMs = 0;

  while (cur < endDate) {
    const eod = new Date(cur);
    eod.setHours(BH_END, 0, 0, 0);
    eod.setMilliseconds(0);

    if (endDate <= eod) {
      totalMs += endDate.getTime() - cur.getTime();
      break;
    }
    totalMs += eod.getTime() - cur.getTime();
    cur = nextBusinessDayStart(cur);
  }

  return totalMs;
}

/** Business milliseconds from start to right now. */
export function businessDurationNow(start: Date | string): number {
  return calculateBusinessDuration(start, new Date());
}

/**
 * Format business-time milliseconds into a compact string.
 * One "day" = one business day (9 h).
 * Examples: "45m", "6h", "1d 4h", "5d".
 */
export function formatBusinessDuration(ms: number): string {
  if (!isFinite(ms) || ms < 0) return "—";
  if (ms === 0) return "0m";
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const totalH = Math.floor(ms / 3_600_000);
  if (totalH < BH_HOURS) return `${totalH}h`;
  const days = Math.floor(totalH / BH_HOURS);
  const remH  = totalH % BH_HOURS;
  return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
}
