import { lazy, Suspense } from "react";
import { Card, Skeleton } from "@/components/ui";
import { useHealthQuery } from "./hooks";
import { QueryState } from "./ui";
import { analyticsPath, type DateRange } from "./dashboard-data";
import { metrics } from "./metrics";
import type { Analytics, AnalyticsBucket, AnalyticsGranularity, Metric } from "./types";

const AnalyticsChart = lazy(() => import("./AnalyticsChart"));
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });
const value = (n: number | null) => (n === null ? "—" : number.format(n));
const exclusionLabels: Record<string, string> = {
  UNKNOWN_UNIT: "đơn vị không nhận diện",
  INVALID_VALUE: "giá trị không hợp lệ",
  INCOMPLETE_BLOOD_PRESSURE: "huyết áp thiếu hoặc sai một vế",
  UNEXPECTED_SECONDARY_VALUE: "số đo có giá trị phụ không phù hợp",
};

function bucketLabel(bucket: AnalyticsBucket) {
  return `${bucket.period_start} – ${bucket.period_end} (không gồm ngày cuối)`;
}

export function AnalyticsView({
  metric,
  range,
  granularity,
}: {
  metric: Metric;
  range: DateRange;
  granularity: AnalyticsGranularity;
}) {
  const path = analyticsPath(metric, range, granularity);
  const query = useHealthQuery<Analytics>(path);
  const data = query.data;
  return (
    <QueryState query={query}>
      {data && (
        <Card className="min-w-0 p-4 sm:p-6">
          <h2 className="mb-1 text-lg font-semibold">
            Thống kê {metrics[metric].label.toLowerCase()} ({data.unit})
          </h2>
          <p className="mb-3 text-sm text-ink-600">
            Theo {granularity === "day" ? "ngày" : granularity === "week" ? "tuần" : "tháng"} · giờ
            Việt Nam · trung bình và khoảng giá trị đã ghi. Khoảng đầu/cuối có thể chỉ chứa một phần
            kỳ lịch.
          </p>
          {data.excluded_count > 0 && (
            <div role="status" className="mb-3 text-sm text-ink-600">
              <p>{data.excluded_count} số đo cũ không thể tổng hợp:</p>
              <ul className="list-inside list-disc">
                {Object.entries(data.excluded_reasons).map(([reason, count]) => (
                  <li key={reason}>
                    {count} · {exclusionLabels[reason] || reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.buckets.every((bucket) => bucket.count === 0) && (
            <p>Chưa có số đo {metrics[metric].label.toLowerCase()} trong khoảng này.</p>
          )}
          <Suspense fallback={<Skeleton className="h-[280px] w-full" />}>
            <AnalyticsChart
              buckets={data.buckets}
              label={metrics[metric].label}
              unit={data.unit}
              bloodPressure={metric === "BLOOD_PRESSURE"}
            />
          </Suspense>
          <div
            className="mt-5 overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Bảng thống kê số đo"
          >
            <table className="w-full text-left text-sm">
              <caption className="mb-2 text-left font-semibold">Bảng thống kê số đo</caption>
              <thead>
                <tr className="border-b border-line-200">
                  <th scope="col" className="p-2">
                    Khoảng lịch
                  </th>
                  <th scope="col" className="p-2">
                    Lần đo
                  </th>
                  <th scope="col" className="p-2">
                    {metric === "BLOOD_PRESSURE"
                      ? "Tâm thu TB / thấp / cao"
                      : "Trung bình / thấp / cao"}
                  </th>
                  {metric === "BLOOD_PRESSURE" && (
                    <th scope="col" className="p-2">
                      Tâm trương TB / thấp / cao
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.buckets.map((bucket) => (
                  <tr key={bucket.period_start} className="border-b border-line-200">
                    <td className="p-2 whitespace-nowrap">{bucketLabel(bucket)}</td>
                    <td className="p-2">{bucket.count}</td>
                    <td className="p-2 whitespace-nowrap">
                      {value(bucket.average)} / {value(bucket.minimum)} / {value(bucket.maximum)}{" "}
                      {data.unit}
                    </td>
                    {metric === "BLOOD_PRESSURE" && (
                      <td className="p-2 whitespace-nowrap">
                        {value(bucket.secondary_average)} / {value(bucket.secondary_minimum)} /{" "}
                        {value(bucket.secondary_maximum)} {data.unit}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </QueryState>
  );
}
