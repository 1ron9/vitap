export function localDateTime(iso: string | Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (kind: string) => parts.find((p) => p.type === kind)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}
export const today = () => localDateTime(new Date()).slice(0, 10);
export const toUtc = (value: string) => new Date(`${value}+07:00`).toISOString();
export function dayBounds(from: string, to: string) {
  const result: Record<string, string> = {};
  if (from) result.from = toUtc(`${from}T00:00:00`);
  if (to) result.to = new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86400000).toISOString();
  return result;
}
export const displayTime = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
