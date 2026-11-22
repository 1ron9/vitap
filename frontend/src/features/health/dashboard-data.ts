import { readHealth } from "./hooks";
import { dayBounds, today } from "./time";
import { metrics } from "./metrics";
import type { AnalyticsGranularity, Metric, Page, RawObservation } from "./types";

const DAY_MS = 86_400_000;
const PAGE_SIZE = 100;
export type Preset = "day" | "week" | "month";
export type DateRange = { from: string; to: string };

export function presetRange(preset: Preset, localDay = today()): DateRange {
  const date = new Date(`${localDay}T00:00:00Z`);
  const key = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === "day") return { from: localDay, to: localDay };
  if (preset === "week") {
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return { from: key(date), to: key(new Date(date.getTime() + 6 * DAY_MS)) };
  }
  date.setUTCDate(1);
  const from = key(date);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return { from, to: key(date) };
}

export function dashboardBounds(range: DateRange): DateRange | null {
  if (!range.from || !range.to || range.from > range.to) return null;
  try {
    const { from, to } = dayBounds(range.from, range.to);
    const length = Date.parse(to) - Date.parse(from);
    return length > 0 && length <= 366 * DAY_MS ? { from, to } : null;
  } catch {
    return null;
  }
}

export function observationsPath(metric: Metric, bounds: DateRange) {
  return `/observations?${new URLSearchParams({ observation_type: metric, ...bounds })}`;
}

export function analyticsPath(metric: Metric, range: DateRange, granularity: AnalyticsGranularity) {
  if (!dashboardBounds(range)) return null;
  const next = new Date(`${range.to}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  if (Number.isNaN(next.getTime()) || next.getUTCFullYear() > 9999) return null;
  return `/analytics?${new URLSearchParams({
    observation_type: metric,
    from: range.from,
    to: next.toISOString().slice(0, 10),
    granularity,
    timezone: "Asia/Ho_Chi_Minh",
  })}`;
}

export async function loadObservationSeries(
  path: string,
  signal: AbortSignal,
): Promise<RawObservation[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const items: RawObservation[] = [];
    const ids = new Set<string>();
    let total = 0;
    let consistent = true;
    // Fetch one page at a time so a changed range or a failed page stops further requests.
    for (let page = 1; page === 1 || items.length < total; page++) {
      signal.throwIfAborted();
      const result = await readHealth<Page<RawObservation>>(
        `${path}&page=${page}&page_size=${PAGE_SIZE}`,
        signal,
      );
      signal.throwIfAborted();
      if (page === 1) total = result.pagination.total;
      const expected = Math.min(PAGE_SIZE, total - items.length);
      if (
        !Number.isSafeInteger(total) ||
        total < 0 ||
        result.pagination.total !== total ||
        result.pagination.page !== page ||
        result.pagination.page_size !== PAGE_SIZE ||
        result.items.length !== expected
      ) {
        consistent = false;
        break;
      }
      for (const item of result.items) ids.add(item.id);
      items.push(...result.items);
      if (ids.size !== items.length) {
        consistent = false;
        break;
      }
    }
    if (consistent) return items;
  }
  throw new Error("Danh sách số đo đã thay đổi trong lúc tải. Hãy thử lại.");
}

export type ChartPoint = { time: number; y: number; reading: RawObservation };
export function chartPoints(items: RawObservation[], metric: Metric) {
  const primary: ChartPoint[] = [],
    secondary: ChartPoint[] = [];
  let min = Infinity,
    max = -Infinity,
    excluded = 0;
  function add(points: ChartPoint[], time: number, y: number, reading: RawObservation) {
    points.push({ time, y, reading });
    min = Math.min(min, y);
    max = Math.max(max, y);
  }
  for (const item of items) {
    const time = Date.parse(item.measured_at);
    const legacyGlucose = metric === "GLUCOSE" && item.unit === "mg/dL";
    if (
      !Number.isFinite(time) ||
      !Number.isFinite(item.value) ||
      (item.unit !== metrics[metric].unit && !legacyGlucose)
    ) {
      excluded++;
      continue;
    }
    add(primary, time, legacyGlucose ? item.value / 18 : item.value, item);
    if (
      metric === "BLOOD_PRESSURE" &&
      item.secondary_value !== null &&
      Number.isFinite(item.secondary_value)
    )
      add(secondary, time, item.secondary_value, item);
  }
  const margin = min === max ? Math.max(Math.abs(min) * 0.05, 0.1) : (max - min) * 0.08;
  const domain: [number, number] = primary.length ? [min - margin, max + margin] : [0, 1];
  return { primary, secondary, domain, excluded };
}

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });
export function readingText(item: RawObservation) {
  const value = number.format(item.entered_value ?? item.value);
  const secondary = item.secondary_value === null ? "" : `/${number.format(item.secondary_value)}`;
  return `${value}${secondary} ${item.entered_unit ?? item.unit}`;
}
